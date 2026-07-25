import type { MarketHit } from "./types";
import type { OfferVerdict } from "./ai-triage";

/**
 * Folding the AI's verdicts back into the results — pure, so the rule that
 * decides what a user does and does not see is testable in isolation.
 *
 * The bias is deliberate and one-directional: **an offer is kept unless the
 * model explicitly said to drop it.** A missing verdict, an out-of-range index,
 * a truncated response — every failure keeps the offer. Hiding a good job costs
 * the person something real and is invisible to us; showing an average one
 * costs them three seconds. The asymmetry of those two mistakes is the whole
 * design.
 *
 * A verdict may also supply `matched` skills, which fills a gap the audit
 * measured: the demand side of an offer was never extracted, so the match
 * evidence was always empty. These names are only accepted when the model
 * claims to have found them on BOTH sides — and they replace nothing that the
 * deterministic path already found.
 */
export function applyTriage(
  hits: readonly MarketHit[],
  verdicts: readonly OfferVerdict[] | null,
): MarketHit[] {
  if (verdicts === null) return [...hits];
  const byIndex = new Map(verdicts.map((v) => [v.index, v]));
  const kept: MarketHit[] = [];
  hits.forEach((hit, index) => {
    const verdict = byIndex.get(index);
    // No verdict = keep. Silence must never delete an opportunity.
    if (verdict && !verdict.keep) return;
    kept.push(
      verdict && verdict.matched.length > 0 && hit.matchedSkills.length === 0
        ? {
            ...hit,
            matchedSkills: verdict.matched,
            // The offer's own skill list stays whatever the source stated; we
            // only report how many the model could line up, so the ratio the
            // UI shows never claims more than was actually compared.
            demandedSkillCount: Math.max(
              hit.demandedSkillCount,
              verdict.matched.length,
            ),
          }
        : hit,
    );
  });
  return kept;
}
