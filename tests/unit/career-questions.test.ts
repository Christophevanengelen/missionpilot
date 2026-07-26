import { describe, expect, it } from "vitest";
import { nextQuestion, pendingQuestions } from "@/lib/profile/next-question";
import { summariseUnderstanding } from "@/lib/profile/understood";
import { assessReadiness } from "@/lib/profile/readiness";
import { applyAnswer } from "@/lib/profile/answer-apply";
import { buildProfileDossier } from "@/lib/matching/insight-logic";

const COMPLETE_CLAIMS = [
  { kind: "role", value: { title: "Service Designer" } },
  { kind: "seniority", value: { level: "Senior" } },
  { kind: "years_experience", value: { years: 9 } },
];

const COMPLETE_PREFS = {
  targetRoleFamilies: ["Head of Design"],
  allowedWorkRegions: ["France"],
  preferredEngagementTypes: ["permanent"],
  remotePolicy: "hybrid" as string | null,
};

function context(
  careerQuestions: { questionKey: string; question: string }[] = [],
  claims = COMPLETE_CLAIMS,
  preferences = COMPLETE_PREFS,
) {
  return {
    readiness: assessReadiness({
      confirmedClaims: claims,
      preferences,
      testimonialCount: 0,
      openTrajectoryQuestions: 0,
    }),
    understood: summariseUnderstanding(claims),
    preferences,
    settledKeys: [] as string[],
    careerQuestions,
  };
}

const SCOPE_Q = {
  questionKey: "career:combien de personnes encadriez vous",
  question: "Combien de personnes encadriez-vous chez Acme ?",
};

describe("career questions in the same conversation", () => {
  it("comes LAST — never before the product has shown anything", () => {
    // Scope questions are the most demanding to answer. Asking them of someone
    // still staring at an empty screen is the interrogation this design
    // refuses; asking them of someone who already has results is a
    // conversation.
    const all = pendingQuestions(
      context([SCOPE_Q], [], {
        targetRoleFamilies: [],
        allowedWorkRegions: [],
        preferredEngagementTypes: [],
        remotePolicy: null,
      }),
    );
    expect(all[0].key).toBe("gap:role");
    expect(all[all.length - 1].key).toBe(SCOPE_Q.questionKey);
  });

  it("is asked once every deterministic question is settled", () => {
    const question = nextQuestion(context([SCOPE_Q]));
    expect(question?.key).toBe(SCOPE_Q.questionKey);
    expect(question?.prompt).toBe(SCOPE_Q.question);
    expect(question?.target).toEqual({ kind: "dossier" });
  });

  it("says why it is worth answering, in terms of the step up", () => {
    const question = nextQuestion(context([SCOPE_Q]));
    expect(question?.because).toMatch(/marche d'après/);
  });

  it("is never asked again once settled", () => {
    const ctx = context([SCOPE_Q]);
    const question = nextQuestion({
      ...ctx,
      settledKeys: [SCOPE_Q.questionKey],
    });
    expect(question).toBeNull();
  });

  it("returns null when the career reading had nothing to ask", () => {
    expect(nextQuestion(context([]))).toBeNull();
  });
});

describe("answering a scope question", () => {
  it("accepts a sentence — there is no vocabulary to validate against", () => {
    // Rejecting answers that "don't look like" a team size would throw away
    // exactly the nuance these questions were asked to capture.
    const result = applyAnswer(
      { kind: "dossier" },
      "Une équipe de 12 sur 3 pays, avec un budget de 400 k€",
    );
    expect(result).toEqual({ ok: true, applied: { to: "dossier" } });
  });

  it("still refuses an empty answer", () => {
    expect(applyAnswer({ kind: "dossier" }, "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("the answer reaches the dossier", () => {
  const claims = COMPLETE_CLAIMS.map((c) => ({ ...c, state: "confirmed" }));

  it("appears, marked as declared rather than read from a document", () => {
    // THE POINT OF THE WHOLE LOOP. The career reading answers `unknown`
    // because a CV lists titles without scope; an answer that never reaches
    // the dossier leaves the next reading exactly as blind, and the question
    // returns forever.
    const dossier = buildProfileDossier(claims, { targetRoleFamilies: [] }, [
      { question: SCOPE_Q.question, answer: "12 personnes, 3 pays" },
    ]);
    expect(dossier).toContain("déclaratif");
    expect(dossier).toContain("12 personnes, 3 pays");
    expect(dossier).toContain(SCOPE_Q.question);
  });

  it("adds nothing at all when there are no answers", () => {
    const dossier = buildProfileDossier(claims, { targetRoleFamilies: [] });
    expect(dossier).not.toContain("déclaratif");
  });

  it("ignores a blank answer rather than emitting an empty line", () => {
    const dossier = buildProfileDossier(claims, { targetRoleFamilies: [] }, [
      { question: "  ", answer: "12 personnes" },
      { question: SCOPE_Q.question, answer: "   " },
    ]);
    expect(dossier).not.toContain("déclaratif");
  });
});
