import { describe, expect, it } from "vitest";
import { buildStaircase } from "@/lib/search/staircase";
import type { MarketHit } from "@/lib/search/types";

function hit(title: string | null, over: Partial<MarketHit> = {}): MarketHit {
  return {
    key: title ?? Math.random().toString(36),
    title,
    organization: "Nova",
    locationText: null,
    engagementType: null,
    remoteType: null,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    skills: [],
    excerpt: null,
    postedAt: null,
    sources: [{ name: "Himalayas", url: "https://himalayas.app/1" }],
    sourceName: "Himalayas",
    sourceUrl: "https://himalayas.app/1",
    gate: "eligible",
    score: 50,
    confidence: "high",
    titlePhraseMatch: true,
    matchedSkills: [],
    demandedSkillCount: 0,
    unknowns: [],
    ...over,
  };
}

/**
 * The staircase is the product's distinctive promise: people apply for the job
 * they already had, because nobody told them they were ready for the next.
 */
describe("buildStaircase", () => {
  const LABELS = { stepUp: "Design Director", level: "Lead Designer" };

  it("puts the step up FIRST — it is the reason the product exists", () => {
    const bands = buildStaircase(
      [hit("Lead Designer"), hit("Design Director EMEA")],
      ["Design Director"],
      LABELS,
    );
    expect(bands.map((b) => b.key)).toEqual(["step_up", "level"]);
    expect(bands[0].hits[0].title).toBe("Design Director EMEA");
  });

  it("says nothing about a step it cannot justify", () => {
    // No authorised step-up phrasing — because the career analysis found no
    // headroom, or could not tell. One band, and no claim.
    const bands = buildStaircase([hit("Lead Designer")], [], LABELS);
    expect(bands).toHaveLength(1);
    expect(bands[0].key).toBe("level");
  });

  it("omits an empty band rather than promising an empty rung", () => {
    const bands = buildStaircase(
      [hit("Lead Designer")],
      ["Design Director"],
      LABELS,
    );
    expect(bands.map((b) => b.key)).toEqual(["level"]);
  });

  it("reads a title that matches both ways as the higher rung", () => {
    // "Lead Designer / Design Director" is genuinely ambiguous; showing it as
    // the step up is the useful reading, and the title is right there to check.
    const bands = buildStaircase(
      [hit("Lead Designer, acting Design Director")],
      ["Design Director"],
      LABELS,
    );
    expect(bands[0].key).toBe("step_up");
  });

  it("matches across case, accents and punctuation", () => {
    // Folding removes accents and collapses punctuation, so the same words in
    // a different typography are the same phrase. It does NOT invent
    // morphology: "directeur" and "directrice" are different words, and
    // guessing between them is the kind of cleverness that misfiles offers.
    const bands = buildStaircase(
      [hit("DIRECTEUR  DU-DESIGN, EMEA")],
      ["Directeur du désign"],
      LABELS,
    );
    expect(bands[0].key).toBe("step_up");
  });

  it("never classifies an untitled offer as a step up", () => {
    // Unknown is not a promotion.
    const bands = buildStaircase([hit(null)], ["Design Director"], LABELS);
    expect(bands[0].key).toBe("level");
  });

  it("keeps the incoming order inside a band, so relevance still leads", () => {
    const bands = buildStaircase(
      [hit("Lead Designer A"), hit("Lead Designer B")],
      [],
      LABELS,
    );
    expect(bands[0].hits.map((h) => h.title)).toEqual([
      "Lead Designer A",
      "Lead Designer B",
    ]);
  });
});
