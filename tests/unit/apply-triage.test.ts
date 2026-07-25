import { describe, expect, it } from "vitest";
import { applyTriage } from "@/lib/search/apply-triage";
import type { MarketHit } from "@/lib/search/types";
import type { OfferVerdict } from "@/lib/search/ai-triage";

function hit(title: string, over: Partial<MarketHit> = {}): MarketHit {
  return {
    key: title,
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
    sources: [{ name: "Adzuna", url: "https://adzuna.fr/1" }],
    sourceName: "Adzuna",
    sourceUrl: "https://adzuna.fr/1",
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

const verdict = (
  index: number,
  keep: boolean,
  matched: string[] = [],
): OfferVerdict => ({ index, keep, matched, reason: "—" });

/**
 * The asymmetry of the two mistakes IS the design: hiding a good job costs the
 * person something real and is invisible to us; showing an average one costs
 * three seconds.
 */
describe("applyTriage", () => {
  it("drops only what the model explicitly rejected", () => {
    const hits = [hit("Service Designer"), hit("Designer floral")];
    const kept = applyTriage(hits, [verdict(0, true), verdict(1, false)]);
    expect(kept.map((h) => h.title)).toEqual(["Service Designer"]);
  });

  it("keeps an offer the model said nothing about", () => {
    // A truncated response must not delete opportunities.
    const hits = [hit("A"), hit("B"), hit("C")];
    expect(applyTriage(hits, [verdict(0, true)])).toHaveLength(3);
  });

  it("keeps everything when AI is unavailable", () => {
    const hits = [hit("A"), hit("B")];
    expect(applyTriage(hits, null)).toHaveLength(2);
  });

  it("ignores a verdict pointing at an index that does not exist", () => {
    const hits = [hit("A")];
    expect(applyTriage(hits, [verdict(9, false)])).toHaveLength(1);
  });

  it("fills the match evidence the deterministic path could not find", () => {
    // The audit's finding: an offer's requirements were never extracted, so
    // the evidence was always empty and the ratio unreadable.
    const kept = applyTriage(
      [hit("Service Designer")],
      [verdict(0, true, ["Figma", "Design System"])],
    );
    expect(kept[0].matchedSkills).toEqual(["Figma", "Design System"]);
    expect(kept[0].demandedSkillCount).toBe(2);
  });

  it("never overwrites evidence the deterministic path DID find", () => {
    // What the source actually stated outranks what a model inferred.
    const kept = applyTriage(
      [hit("A", { matchedSkills: ["Sketch"], demandedSkillCount: 4 })],
      [verdict(0, true, ["Figma"])],
    );
    expect(kept[0].matchedSkills).toEqual(["Sketch"]);
    expect(kept[0].demandedSkillCount).toBe(4);
  });

  it("never lets the ratio claim more matches than were compared", () => {
    const kept = applyTriage(
      [hit("A", { demandedSkillCount: 1 })],
      [verdict(0, true, ["Figma", "Design System", "Recherche"])],
    );
    expect(kept[0].demandedSkillCount).toBeGreaterThanOrEqual(
      kept[0].matchedSkills.length,
    );
  });

  it("preserves order", () => {
    const hits = [hit("A"), hit("B"), hit("C")];
    const kept = applyTriage(hits, [verdict(1, false)]);
    expect(kept.map((h) => h.title)).toEqual(["A", "C"]);
  });
});
