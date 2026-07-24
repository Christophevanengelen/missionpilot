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

const { aiMatchBreakdown, aiBreakdownConfigured } =
  await import("@/lib/matching/ai-breakdown");

describe("ai-breakdown gating (unconfigured environment)", () => {
  it("reports unconfigured and returns null without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(aiBreakdownConfigured()).toBe(false);
      await expect(
        aiMatchBreakdown("Rôle: Data Engineer", "Offre: Data Engineer"),
      ).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
