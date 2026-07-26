import { describe, expect, it } from "vitest";
import { nextQuestion, pendingQuestions } from "@/lib/profile/next-question";
import { summariseUnderstanding } from "@/lib/profile/understood";
import { assessReadiness } from "@/lib/profile/readiness";

type Preferences = {
  targetRoleFamilies: string[];
  allowedWorkRegions: string[];
  preferredEngagementTypes: string[];
  remotePolicy: string | null;
};

const NO_PREFERENCES: Preferences = {
  targetRoleFamilies: [],
  allowedWorkRegions: [],
  preferredEngagementTypes: [],
  remotePolicy: null,
};

function context(
  claims: { kind: string; value: unknown }[] = [],
  preferences: Partial<Preferences> = {},
  settledKeys: string[] = [],
) {
  const prefs = { ...NO_PREFERENCES, ...preferences };
  return {
    readiness: assessReadiness({
      confirmedClaims: claims,
      preferences: prefs,
      testimonialCount: 0,
      openTrajectoryQuestions: 0,
    }),
    understood: summariseUnderstanding(claims),
    preferences: prefs,
    settledKeys,
  };
}

describe("nextQuestion", () => {
  it("asks for the role first — without it there is nothing to search", () => {
    const question = nextQuestion(context());
    expect(question?.key).toBe("gap:role");
  });

  it("moves on once the role is known", () => {
    const question = nextQuestion(
      context([{ kind: "role", value: { title: "Service Designer" } }]),
    );
    expect(question?.key).toBe("gap:seniority");
  });

  it("never asks a settled question again — answered or skipped alike", () => {
    // A skip is as final as an answer. Re-asking something someone already
    // declined reads as not listening.
    const question = nextQuestion(
      context([], {}, ["gap:role", "gap:seniority"]),
    );
    expect(question?.key).toBe("gap:years");
  });

  it("returns null when nothing useful is left to ask", () => {
    const question = nextQuestion(
      context(
        [
          { kind: "role", value: { title: "Service Designer" } },
          { kind: "seniority", value: { level: "Senior" } },
          { kind: "years_experience", value: { years: 9 } },
        ],
        {
          targetRoleFamilies: ["Head of Design"],
          allowedWorkRegions: ["France"],
          preferredEngagementTypes: ["permanent"],
          remotePolicy: "hybrid",
        },
      ),
    );
    expect(question).toBeNull();
  });

  it("offers the target roles as choices when they are already known", () => {
    const question = nextQuestion(
      context([], { targetRoleFamilies: ["Service Designer", "UX Lead"] }),
    );
    expect(question?.key).toBe("gap:role");
    expect(question?.options.map((o) => o.value)).toEqual([
      "Service Designer",
      "UX Lead",
    ]);
  });

  it("gives every question a reason expressed as the person's benefit", () => {
    // A question whose stated reason is "to complete your profile" describes
    // our bookkeeping. Every one of these must say what it changes for them.
    for (const question of pendingQuestions(context())) {
      expect(question.because).not.toMatch(/compléter votre profil/i);
      expect(question.because.length).toBeGreaterThan(20);
    }
  });

  it("keys are unique, so a settled question can never mask another", () => {
    const keys = pendingQuestions(context()).map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
