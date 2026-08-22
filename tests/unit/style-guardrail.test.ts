import { describe, expect, it } from "vitest";
import {
  buildCorrectionNote,
  checkStyleGuardrail,
  summarizeGuardrailRetryCost,
} from "@/lib/matching/style-guardrail";

// Deterministic phrase matching (ENGINEERING_PRINCIPLES.md §3) — the
// enforcement mechanism the tailoring workflow runs BEFORE a draft is ever
// persisted (Apply Pack L3).

describe("checkStyleGuardrail", () => {
  it("clean content produces no violations", () => {
    const violations = checkStyleGuardrail({
      coverLetter:
        "Madame, Monsieur, j'ai conçu des pipelines de données pour Nova SA.",
      subject: "Candidature — Data Engineer chez Nova SA",
    });
    expect(violations).toEqual([]);
  });

  it("flags a built-in French cliché in the cover letter", () => {
    const violations = checkStyleGuardrail({
      coverLetter: "Je me permets de vous contacter pour ce poste.",
      subject: "Candidature",
    });
    expect(violations).toContainEqual({
      field: "coverLetter",
      phrase: "je me permets de vous contacter",
    });
  });

  it("flags a built-in English cliché in the subject", () => {
    const violations = checkStyleGuardrail({
      coverLetter: "I have shipped production data pipelines.",
      subject: "Application — passionate self-starter for Data Engineer",
    });
    expect(violations).toContainEqual({
      field: "subject",
      phrase: "passionate self-starter",
    });
  });

  it("matching is case-insensitive and accent-insensitive", () => {
    const violations = checkStyleGuardrail({
      coverLetter: "PASSIONNÉ DE LONGUE DATE par ce secteur.",
      subject: "x",
    });
    expect(violations).toContainEqual({
      field: "coverLetter",
      phrase: "passionné de longue date",
    });
  });

  it("checks the profile's own extra banned phrases too", () => {
    const violations = checkStyleGuardrail(
      {
        coverLetter: "Un vrai couteau suisse pour votre équipe.",
        subject: "x",
      },
      ["couteau suisse"],
    );
    expect(violations).toContainEqual({
      field: "coverLetter",
      phrase: "couteau suisse",
    });
  });

  it("an extra banned phrase that never appears produces no violation", () => {
    const violations = checkStyleGuardrail(
      { coverLetter: "Texte tout à fait ordinaire.", subject: "x" },
      ["formule bannie qui n'apparaît jamais"],
    );
    expect(violations).toEqual([]);
  });

  it("is exact substring matching, not fuzzy — a near-miss is not flagged", () => {
    const violations = checkStyleGuardrail({
      coverLetter: "Je suis rigoureux et autonome dans mon travail.",
      subject: "x",
    });
    // "autonome et rigoureux" (the banned phrase) is not a substring of this
    // sentence, even though both words appear separately.
    expect(violations).toEqual([]);
  });
});

// Regression: the guardrail's bounded regeneration retry doubles LLM spend
// for that draft, but nothing distinguished it from an ordinary single-call
// draft in the cost data available to the caller — only two unrelated
// per-call provider log lines showed it (ENGINEERING_PRINCIPLES.md §13,
// "cost is observable for every model call"). tailor-actions.ts's
// enforceStyleGuardrail now logs this summary whenever a retry happens.
describe("summarizeGuardrailRetryCost", () => {
  it("sums both attempts when the retry succeeds", () => {
    const summary = summarizeGuardrailRetryCost(
      { inputTokens: 100, outputTokens: 50, estimatedCost: 0.001 },
      { inputTokens: 120, outputTokens: 60, estimatedCost: 0.0012 },
    );
    expect(summary.attempts).toBe(2);
    expect(summary.totalInputTokens).toBe(220);
    expect(summary.totalOutputTokens).toBe(110);
    expect(summary.totalCost).toBeCloseTo(0.0022, 10);
    expect(summary.retrySucceeded).toBe(true);
  });

  it("still attributes the first attempt's cost when the retry itself fails", () => {
    // A failed retry (provider error/timeout → aiTailorApplication returns
    // null) has no usage figure of its own, but the first attempt's spend
    // must still show up here — it was never silently dropped.
    const summary = summarizeGuardrailRetryCost(
      { inputTokens: 100, outputTokens: 50, estimatedCost: 0.001 },
      null,
    );
    expect(summary).toEqual({
      attempts: 2,
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalCost: 0.001,
      retrySucceeded: false,
    });
  });
});

describe("buildCorrectionNote", () => {
  it("names every distinct offending phrase, once each", () => {
    const note = buildCorrectionNote([
      { field: "coverLetter", phrase: "team player" },
      { field: "subject", phrase: "team player" },
      { field: "coverLetter", phrase: "proven track record" },
    ]);
    expect(note).toContain("team player");
    expect(note).toContain("proven track record");
    // "team player" only once, even though it violated twice.
    expect(note.split("team player")).toHaveLength(2);
  });
});
