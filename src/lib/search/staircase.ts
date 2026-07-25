/**
 * Turning a result list into a STAIRCASE.
 *
 * Every job search product returns a flat list ranked by relevance, which
 * quietly means "more of what you already are". The distinctive promise here is
 * the opposite one: people apply for the job they already had because nobody
 * told them they were ready for the next. So the results are split by ALTITUDE,
 * and the step up is shown FIRST — it is the reason the product exists.
 *
 * Classification is deterministic and checkable: an offer belongs to the step
 * up when its TITLE carries one of the higher-level phrasings the career
 * analysis authorised. No score threshold, no model deciding after the fact —
 * the user can read the title and see why it is there.
 *
 * The band is never asserted without grounds. When no step up was earned — or
 * when the career analysis could not tell and left questions unanswered — there
 * is simply one band, and the product says nothing about a step it cannot
 * justify.
 */

import type { MarketHit } from "./types";

export type StaircaseBand = {
  /** "step_up" is rendered first when present. */
  key: "step_up" | "level";
  /** The level's own words, e.g. "Design Director" — shown as the band title. */
  levelLabel: string | null;
  hits: MarketHit[];
};

/** Comparison form: accents and punctuation removed, spaces collapsed. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCarries(
  title: string | null,
  phrases: readonly string[],
): boolean {
  if (title === null) return false;
  const folded = fold(title);
  return phrases.some((p) => {
    const needle = fold(p);
    return needle !== "" && folded.includes(needle);
  });
}

/**
 * Split the hits into bands, preserving the incoming order inside each — so the
 * relevance ranking still decides what leads within a band.
 *
 * An offer matching a step-up phrasing goes up even if it also matches a
 * current-level one: when a title reads both ways, showing it as the higher
 * rung is the useful reading, and the user can see the title either way.
 */
export function buildStaircase(
  hits: readonly MarketHit[],
  stepUpTitles: readonly string[],
  labels: { stepUp: string | null; level: string | null },
): StaircaseBand[] {
  if (stepUpTitles.length === 0) {
    return [{ key: "level", levelLabel: labels.level, hits: [...hits] }];
  }
  const stepUp: MarketHit[] = [];
  const level: MarketHit[] = [];
  for (const hit of hits) {
    (titleCarries(hit.title, stepUpTitles) ? stepUp : level).push(hit);
  }
  const bands: StaircaseBand[] = [];
  // The step up leads — that is the whole point. An empty band is omitted
  // rather than shown empty: promising a rung and delivering nothing would be
  // worse than not promising it.
  if (stepUp.length > 0) {
    bands.push({ key: "step_up", levelLabel: labels.stepUp, hits: stepUp });
  }
  if (level.length > 0) {
    bands.push({ key: "level", levelLabel: labels.level, hits: level });
  }
  return bands;
}
