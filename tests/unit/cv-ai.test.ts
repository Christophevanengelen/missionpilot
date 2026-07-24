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

const { aiAnalyzeCvProfile, aiCvConfigured, aiDetectSkills } =
  await import("@/lib/profile/cv-ai");

describe("cv-ai gating (unconfigured environment)", () => {
  it("reports unconfigured and returns null without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(aiCvConfigured()).toBe(false);
      await expect(aiDetectSkills("React developer")).resolves.toBeNull();
      await expect(aiAnalyzeCvProfile("React developer")).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
