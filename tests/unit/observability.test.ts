import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/lib/observability/logger";
import {
  AiValidationError,
  OwnershipError,
  sanitizeError,
} from "@/lib/security/errors";

describe("structured logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits JSON lines carrying correlationId, runId, stepName and attempt", () => {
    const logger = createLogger({ correlationId: "health-k1" }).child({
      runId: "run-1",
      stepName: "check-database",
      attempt: 2,
    });
    logger.info("step recorded", { status: "completed" });

    const line = vi.mocked(console.log).mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: "info",
      message: "step recorded",
      correlationId: "health-k1",
      runId: "run-1",
      stepName: "check-database",
      attempt: 2,
      status: "completed",
    });
    expect(parsed.timestamp).toBeTruthy();
  });

  it("routes error level to console.error", () => {
    createLogger({ correlationId: "c" }).error("boom", { errorCode: "X" });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("sanitizeError", () => {
  it("keeps code and safe message for known error classes", () => {
    expect(sanitizeError(new AiValidationError())).toEqual({
      code: "AI_VALIDATION_FAILED",
      message: "AI output failed schema validation",
    });
    expect(sanitizeError(new OwnershipError()).code).toBe(
      "OWNERSHIP_VIOLATION",
    );
  });

  it("collapses unknown errors to a generic internal error", () => {
    const leaky = new Error(
      "connect ECONNREFUSED 127.0.0.1:54321 with sb_secret_abc inside",
    );
    expect(sanitizeError(leaky)).toEqual({
      code: "INTERNAL",
      message: "An internal error occurred.",
    });
    expect(sanitizeError("string error")).toEqual({
      code: "INTERNAL",
      message: "An internal error occurred.",
    });
  });
});
