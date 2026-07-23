import { describe, expect, it } from "vitest";
import {
  assertClaimTransition,
  canTransitionClaim,
  CLAIM_STATES,
  evidenceInputSchema,
  parseClaimValue,
} from "@/domain/profile";

describe("claim state machine", () => {
  it("allows the documented lifecycle transitions", () => {
    expect(canTransitionClaim("proposed", "confirmed")).toBe(true);
    expect(canTransitionClaim("proposed", "needs_review")).toBe(true);
    expect(canTransitionClaim("proposed", "rejected")).toBe(true);
    expect(canTransitionClaim("needs_review", "confirmed")).toBe(true);
    expect(canTransitionClaim("needs_review", "rejected")).toBe(true);
    expect(canTransitionClaim("confirmed", "needs_review")).toBe(true);
    expect(canTransitionClaim("rejected", "proposed")).toBe(true);
  });

  it("refuses silent promotions and any self-loop", () => {
    // An AI/user proposal never becomes confirmed by an illegal path, and a
    // confirmed fact never silently degrades.
    expect(canTransitionClaim("rejected", "confirmed")).toBe(false);
    expect(canTransitionClaim("confirmed", "proposed")).toBe(false);
    expect(canTransitionClaim("confirmed", "rejected")).toBe(false);
    expect(canTransitionClaim("needs_review", "proposed")).toBe(false);
    for (const s of CLAIM_STATES) {
      expect(canTransitionClaim(s, s)).toBe(false);
    }
    expect(() => assertClaimTransition("rejected", "confirmed")).toThrow(
      /illegal claim transition/,
    );
  });
});

describe("claim value schemas", () => {
  it("accepts the documented shapes", () => {
    expect(parseClaimValue("role", { title: "Product Designer" })).toEqual({
      title: "Product Designer",
    });
    expect(parseClaimValue("years_experience", { years: 20 })).toEqual({
      years: 20,
    });
    expect(
      parseClaimValue("achievement", { title: "Refonte du checkout" }),
    ).toEqual({ title: "Refonte du checkout" });
  });

  it("rejects wrong shapes, empty strings and unknown keys", () => {
    expect(() => parseClaimValue("role", { title: "  " })).toThrow();
    expect(() => parseClaimValue("role", { name: "x" })).toThrow();
    expect(() =>
      parseClaimValue("skill", { name: "UX", extra: true }),
    ).toThrow();
    expect(() => parseClaimValue("years_experience", { years: -1 })).toThrow();
    expect(() => parseClaimValue("years_experience", { years: 3.5 })).toThrow();
  });
});

describe("evidence input schema", () => {
  const base = {
    type: "achievement",
    title: "Refonte du checkout",
    statement: "+18 % de conversion sur 6 mois",
    sourceType: "user_stated",
    verificationStatus: "user_confirmed",
  };

  it("accepts a minimal honest evidence", () => {
    const parsed = evidenceInputSchema.parse(base);
    expect(parsed.metrics).toEqual({});
    expect(parsed.tags).toEqual([]);
  });

  it("never lets a user claim external verification", () => {
    expect(() =>
      evidenceInputSchema.parse({
        ...base,
        verificationStatus: "externally_verified",
      }),
    ).toThrow();
  });

  it("refuses an end date before the start date", () => {
    expect(() =>
      evidenceInputSchema.parse({
        ...base,
        startDate: "2024-05-01",
        endDate: "2023-01-01",
      }),
    ).toThrow();
  });
});
