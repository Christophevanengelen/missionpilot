import { describe, expect, it } from "vitest";
import { linkedinAdvice } from "@/lib/profile/linkedin-advice";
import { summariseUnderstanding } from "@/lib/profile/understood";
import { progression } from "@/lib/profile/progression";
import { assessReadiness } from "@/lib/profile/readiness";

describe("linkedinAdvice", () => {
  it("says nothing about a headline when we do not know their métier", () => {
    // Advice that could be given without reading anything is worse than
    // silence: it is indistinguishable from not having read.
    const advice = linkedinAdvice({
      understood: summariseUnderstanding([]),
      testimonialCount: 3,
      achievementCount: 5,
    });
    expect(advice.map((a) => a.key)).not.toContain("headline");
    expect(advice.map((a) => a.key)).not.toContain("skills");
  });

  it("quotes their own métier in the headline advice", () => {
    const advice = linkedinAdvice({
      understood: summariseUnderstanding([
        { kind: "role", value: { title: "Service Designer" } },
        { kind: "seniority", value: { level: "Senior" } },
      ]),
      testimonialCount: 2,
      achievementCount: 3,
    });
    const headline = advice.find((a) => a.key === "headline");
    expect(headline?.grounds).toContain("Service Designer");
    expect(headline?.draft).toBe("Service Designer — Senior");
  });

  it("writes the recommendation request rather than merely suggesting one", () => {
    // "Get recommendations" is the part everyone already knows. The message is
    // the hard part, so it is the part we owe them.
    const advice = linkedinAdvice({
      understood: summariseUnderstanding([
        { kind: "role", value: { title: "Data Engineer" } },
      ]),
      testimonialCount: 0,
      achievementCount: 4,
    });
    const ask = advice.find((a) => a.key === "ask-recommendation");
    expect(ask?.draft).toContain("Data Engineer");
    expect(ask?.draft).toContain("Bonjour");
  });

  it("stops asking for recommendations once some exist", () => {
    const advice = linkedinAdvice({
      understood: summariseUnderstanding([]),
      testimonialCount: 1,
      achievementCount: 4,
    });
    expect(advice.map((a) => a.key)).not.toContain("ask-recommendation");
  });

  it("does not tell someone to quantify when their record already is", () => {
    const advice = linkedinAdvice({
      understood: summariseUnderstanding([]),
      testimonialCount: 2,
      achievementCount: 2,
    });
    expect(advice).toEqual([]);
  });
});

const NO_ALTITUDE = {
  hasRole: false,
  hasSeniority: false,
  hasYears: false,
  achievementCount: 0,
};

const FULL_ALTITUDE = {
  hasRole: true,
  hasSeniority: true,
  hasYears: true,
  achievementCount: 2,
};

describe("progression", () => {
  const emptyReadiness = assessReadiness({
    confirmedClaims: [],
    preferences: {
      targetRoleFamilies: [],
      allowedWorkRegions: [],
      preferredEngagementTypes: [],
      remotePolicy: null,
    },
    testimonialCount: 0,
    openTrajectoryQuestions: 3,
  });

  it("never starts the bar at zero", () => {
    // An effort shown as untouched is abandoned far more often than one
    // already visibly begun — and reading a CV genuinely is progress.
    expect(progression(emptyReadiness, NO_ALTITUDE).fill).toBeGreaterThan(0);
  });

  it("describes each tier as a capability, never as a percentage", () => {
    for (const tier of progression(emptyReadiness, NO_ALTITUDE).tiers) {
      expect(tier.unlocks).not.toMatch(/\d+\s*%/);
      expect(tier.unlocks.length).toBeGreaterThan(20);
    }
  });

  it("reports nothing unlocked on an empty profile, and names the next rung", () => {
    const progress = progression(emptyReadiness, NO_ALTITUDE);
    expect(progress.tiers.every((t) => !t.reached)).toBe(true);
    expect(progress.next?.key).toBe("search");
  });

  it("marks the search tier reached exactly when the engine would search", () => {
    const readiness = assessReadiness({
      confirmedClaims: [
        { kind: "role", value: { title: "Service Designer" } },
        { kind: "seniority", value: { level: "Senior" } },
        { kind: "years_experience", value: { years: 9 } },
        ...Array.from({ length: 5 }, (_, i) => ({
          kind: "skill",
          value: { name: `skill-${i}` },
        })),
      ],
      preferences: {
        targetRoleFamilies: ["Head of Design"],
        allowedWorkRegions: ["France"],
        preferredEngagementTypes: ["permanent"],
        remotePolicy: "hybrid",
      },
      testimonialCount: 0,
      openTrajectoryQuestions: 0,
    });
    const progress = progression(readiness, NO_ALTITUDE);
    expect(readiness.canSearch).toBe(true);
    expect(progress.tiers.find((t) => t.key === "search")?.reached).toBe(true);
  });

  it("refuses the step-up tier on a profile with no altitude in it", () => {
    // THE BUG THIS PINS. The tier used to key off the readiness `trajectory`
    // ratio, which the dashboard marks complete as soon as ANY claim exists —
    // so a profile holding six skills and nothing else announced that the step
    // up was unlocked. A tier must be checkable against something real.
    const readiness = assessReadiness({
      confirmedClaims: Array.from({ length: 6 }, (_, i) => ({
        kind: "skill",
        value: { name: `skill-${i}` },
      })),
      preferences: {
        targetRoleFamilies: [],
        allowedWorkRegions: [],
        preferredEngagementTypes: [],
        remotePolicy: null,
      },
      testimonialCount: 0,
      // What the dashboard actually passes once a single claim exists.
      openTrajectoryQuestions: 0,
    });
    const progress = progression(readiness, NO_ALTITUDE);
    expect(progress.tiers.find((t) => t.key === "stepUp")?.reached).toBe(false);
  });

  it("grants the step-up tier once the record carries altitude", () => {
    const progress = progression(emptyReadiness, FULL_ALTITUDE);
    expect(progress.tiers.find((t) => t.key === "stepUp")?.reached).toBe(true);
  });
});
