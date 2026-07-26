import { describe, expect, it } from "vitest";
import { applyAnswer } from "@/lib/profile/answer-apply";

describe("applyAnswer", () => {
  it("refuses an empty answer rather than storing a blank fact", () => {
    const result = applyAnswer({ kind: "claim", claim: "role" }, "   ");
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("keeps a role exactly as the person wrote it", () => {
    const result = applyAnswer(
      { kind: "claim", claim: "role" },
      "  Service Designer  ",
    );
    expect(result).toEqual({
      ok: true,
      applied: {
        to: "claim",
        kind: "role",
        value: { title: "Service Designer" },
      },
    });
  });

  describe("years of experience", () => {
    it.each([
      ["12", 12],
      ["12 ans", 12],
      ["environ 8 ans", 8],
      ["0", 0],
    ])("reads %s as %i", (raw, expected) => {
      const result = applyAnswer(
        { kind: "claim", claim: "years_experience" },
        raw,
      );
      expect(result).toEqual({
        ok: true,
        applied: {
          to: "claim",
          kind: "years_experience",
          value: { years: expected },
        },
      });
    });

    it("refuses an answer with no number at all", () => {
      const result = applyAnswer(
        { kind: "claim", claim: "years_experience" },
        "ça dépend des périodes",
      );
      expect(result).toEqual({ ok: false, reason: "unreadable" });
    });

    it("refuses an implausible number instead of clamping it", () => {
      // Clamping 300 down to 80 would record a number the person never gave
      // and hide their typo from them. Refusing shows it.
      const result = applyAnswer(
        { kind: "claim", claim: "years_experience" },
        "300 ans",
      );
      expect(result).toEqual({ ok: false, reason: "unreadable" });
    });
  });

  describe("closed vocabularies", () => {
    it("accepts an exact remote policy", () => {
      const result = applyAnswer(
        { kind: "preference", field: "remotePolicy" },
        "remote_only",
      );
      expect(result).toEqual({
        ok: true,
        applied: { to: "preferences", patch: { remotePolicy: "remote_only" } },
      });
    });

    it("refuses free text rather than guessing which policy was meant", () => {
      const result = applyAnswer(
        { kind: "preference", field: "remotePolicy" },
        "plutôt à la maison quand je peux",
      );
      expect(result).toEqual({ ok: false, reason: "unreadable" });
    });

    it("keeps only the engagement types it actually recognises", () => {
      const result = applyAnswer(
        { kind: "preference", field: "preferredEngagementTypes" },
        "freelance, licorne, permanent",
      );
      expect(result).toEqual({
        ok: true,
        applied: {
          to: "preferences",
          patch: { preferredEngagementTypes: ["freelance", "permanent"] },
        },
      });
    });

    it("refuses when nothing in the list is recognised", () => {
      const result = applyAnswer(
        { kind: "preference", field: "preferredEngagementTypes" },
        "licorne, dragon",
      );
      expect(result).toEqual({ ok: false, reason: "unreadable" });
    });
  });

  describe("free lists", () => {
    it("splits on commas, slashes and « et », de-duplicating", () => {
      const result = applyAnswer(
        { kind: "preference", field: "allowedWorkRegions" },
        "France, Belgique / Suisse et france",
      );
      expect(result).toEqual({
        ok: true,
        applied: {
          to: "preferences",
          patch: { allowedWorkRegions: ["France", "Belgique", "Suisse"] },
        },
      });
    });

    it("refuses a list of separators with nothing between them", () => {
      const result = applyAnswer(
        { kind: "preference", field: "allowedWorkRegions" },
        " , , / ",
      );
      expect(result).toEqual({ ok: false, reason: "empty" });
    });
  });
});
