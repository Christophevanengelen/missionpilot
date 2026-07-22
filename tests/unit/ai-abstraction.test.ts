import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MOCK_SLOW_LATENCY_MS, MockAiProvider } from "@/lib/ai/mock-provider";
import { getAiProvider } from "@/lib/ai/registry";
import {
  AiConfigurationError,
  AiProviderError,
  AiValidationError,
  sanitizeError,
} from "@/lib/security/errors";

const dataSchema = z.strictObject({
  status: z.literal("ok"),
  echo: z.string(),
});

function request(input: unknown) {
  return {
    taskName: "unit-test-task",
    promptVersion: "unit-v1",
    input,
    dataSchema,
  };
}

const provider = new MockAiProvider();

describe("mock AI provider (deterministic scenarios)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("success: validated envelope with full metadata", async () => {
    const res = await provider.generateStructured(request({ probe: "x" }));
    expect(res.envelope.status).toBe("completed");
    expect(res.envelope.schemaVersion).toBe("1.0");
    expect(res.envelope.confidence).toBe(95);
    expect(res.envelope.data).toEqual({ status: "ok", echo: "unit-test-task" });
    // Minimal metadata: provider, model, promptVersion, latency, usage, cost.
    expect(res.provider).toBe("mock");
    expect(res.model).toBe("mock-v1");
    expect(res.promptVersion).toBe("unit-v1");
    expect(res.latencyMs).toBeGreaterThan(0);
    expect(res.usage).toEqual({
      inputTokens: 12,
      outputTokens: 24,
      estimatedCost: 0,
    });
  });

  it("is deterministic: identical requests yield identical responses", async () => {
    const a = await provider.generateStructured(request({ probe: "x" }));
    const b = await provider.generateStructured(request({ probe: "x" }));
    expect(a).toEqual(b);
  });

  it("invalid-output: nothing usable before validation — typed, sanitized error", async () => {
    const promise = provider.generateStructured(
      request({ mockScenario: "invalid-output" }),
    );
    await expect(promise).rejects.toBeInstanceOf(AiValidationError);
    await promise.catch((error) => {
      expect(sanitizeError(error)).toEqual({
        code: "AI_VALIDATION_FAILED",
        message: "AI output failed schema validation",
      });
    });
  });

  it("needs-review: low confidence surfaces as a validated needs_review envelope", async () => {
    const res = await provider.generateStructured(
      request({ mockScenario: "needs-review" }),
    );
    expect(res.envelope.status).toBe("needs_review");
    expect(res.envelope.confidence).toBeLessThan(50);
    expect(res.envelope.warnings).toContain(
      "confidence below review threshold",
    );
  });

  it("provider-error: controlled failure with a typed, sanitized error", async () => {
    const promise = provider.generateStructured(
      request({ mockScenario: "provider-error" }),
    );
    await expect(promise).rejects.toBeInstanceOf(AiProviderError);
    await promise.catch((error) => {
      expect(sanitizeError(error).code).toBe("AI_PROVIDER_ERROR");
    });
  });

  it("slow: simulated latency driven by fake timers, never real waiting", async () => {
    vi.useFakeTimers();
    let settled = false;
    const promise = provider
      .generateStructured(request({ mockScenario: "slow" }))
      .then((res) => {
        settled = true;
        return res;
      });

    await vi.advanceTimersByTimeAsync(MOCK_SLOW_LATENCY_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await promise;
    expect(settled).toBe(true);
    expect(res.latencyMs).toBe(MOCK_SLOW_LATENCY_MS);
    expect(res.envelope.status).toBe("completed");
  });

  it("injection: malicious instructions stay inert data — schema, rules and status unchanged", async () => {
    const res = await provider.generateStructured(
      request({ mockScenario: "injection" }),
    );
    // The envelope still validates against the SAME schema and the status is
    // exactly what the envelope declares — embedded "instructions" changed
    // nothing about rules, schema or expected statuses.
    expect(res.envelope.status).toBe("completed");
    expect(res.envelope.schemaVersion).toBe("1.0");
    expect(res.envelope.data.status).toBe("ok");
    expect(res.envelope.data.echo).toContain(
      "IGNORE ALL PREVIOUS INSTRUCTIONS",
    );
    expect(res.envelope.warnings[0]).toContain("SYSTEM OVERRIDE");
    // Untouched contract: same metadata as any completed generation.
    expect(res.provider).toBe("mock");
    expect(res.promptVersion).toBe("unit-v1");
  });

  it("treats an unknown mockScenario value as plain data (default success)", async () => {
    const res = await provider.generateStructured(
      request({ mockScenario: "drop-all-tables" }),
    );
    expect(res.envelope.status).toBe("completed");
  });
});

describe("provider registry (explicit allowlist)", () => {
  it("returns the mock provider by default and by name", () => {
    expect(getAiProvider().name).toBe("mock");
    expect(getAiProvider("mock").name).toBe("mock");
  });

  it("fails cleanly for any provider outside the allowlist", () => {
    for (const name of ["openai", "anthropic", "constructor", "__proto__"]) {
      expect(() => getAiProvider(name), name).toThrow(AiConfigurationError);
    }
    expect(sanitizeError(new AiConfigurationError()).code).toBe(
      "AI_CONFIGURATION_ERROR",
    );
  });
});
