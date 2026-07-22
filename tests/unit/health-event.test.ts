import { describe, expect, it } from "vitest";
import { correlationIdFor, healthEventSchema } from "@/workflows/health-logic";
import { functions } from "@/workflows";

// The Inngest handler rejects with NonRetriableError exactly when this schema
// rejects — these cases pin the handler's permanent-failure branch.
describe("system/health.requested payload contract", () => {
  // Zod 4's z.uuid() enforces the RFC 4122 version/variant bits.
  const valid = {
    userId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "ui-12345678",
  };

  it("accepts a valid payload, with or without the test hook", () => {
    expect(healthEventSchema.safeParse(valid).success).toBe(true);
    expect(
      healthEventSchema.safeParse({ ...valid, simulateAiFailure: true })
        .success,
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    const invalid = [
      {},
      { ...valid, userId: "not-a-uuid" },
      { ...valid, idempotencyKey: "short" },
      { ...valid, idempotencyKey: "x".repeat(201) },
      { ...valid, unexpected: "field" },
      { ...valid, simulateAiFailure: "yes" },
    ];
    for (const payload of invalid) {
      expect(
        healthEventSchema.safeParse(payload).success,
        JSON.stringify(payload),
      ).toBe(false);
    }
  });

  it("derives a stable correlation id from the idempotency key", () => {
    expect(correlationIdFor("abc-123")).toBe("health-abc-123");
  });

  it("registers exactly the system-health function for serving", () => {
    expect(functions).toHaveLength(1);
    // InngestFunction is circular — use its id() accessor, not serialization.
    const fn = functions[0] as unknown as { id: (prefix?: string) => string };
    expect(typeof fn.id).toBe("function");
    expect(fn.id()).toContain("system-health");
  });
});
