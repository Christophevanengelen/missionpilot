import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: undefined,
    AI_DEFAULT_PROVIDER: "mock",
    AI_DEFAULT_MODEL: "mock-v1",
    LOG_LEVEL: "error",
    APP_ENV: "local",
  },
}));

const { aiInterviewBrief, aiInterviewConfigured } =
  await import("@/lib/matching/ai-interview");

// The schema must reject an all-empty brief: it would persist, render blank
// and be unregenerable (freshness short-circuits forever).
describe("ai-interview schema floor", () => {
  it("requires at least one question", async () => {
    const { z } = await import("zod");
    const shape = z
      .object({
        questions: z
          .array(
            z
              .object({
                question: z.string().trim().min(1).max(300),
                angle: z.string().trim().min(1).max(500),
              })
              .strict(),
          )
          .min(1)
          .max(12),
        talkingPoints: z.array(z.string().trim().min(1).max(300)).max(8),
      })
      .strict();
    expect(shape.safeParse({ questions: [], talkingPoints: [] }).success).toBe(
      false,
    );
    expect(
      shape.safeParse({
        questions: [{ question: "Q ?", angle: "Citer Nova" }],
        talkingPoints: [],
      }).success,
    ).toBe(true);
  });
});

describe("ai-interview gating (unconfigured environment)", () => {
  it("reports unconfigured and returns null without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(aiInterviewConfigured()).toBe(false);
      await expect(
        aiInterviewBrief("Rôle: Data Engineer", "Offre: Data Engineer"),
      ).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
