/**
 * Inbox ranking (Phase 3, PR 4). Pure comparator: the deterministic gate is the
 * primary key (eligible → review → excluded), then the overall match score
 * descending, with unscored (null) opportunities last. Ties keep their incoming
 * order (Array.sort is stable), which callers seed by `last_seen_at` desc.
 */
import type { EligibilityGate } from "./hard-constraints";

const GATE_ORDER: Record<EligibilityGate, number> = {
  eligible: 0,
  review: 1,
  excluded: 2,
};

export type Ranked = { gate: EligibilityGate; score: number | null };

export function compareRanked(a: Ranked, b: Ranked): number {
  if (GATE_ORDER[a.gate] !== GATE_ORDER[b.gate]) {
    return GATE_ORDER[a.gate] - GATE_ORDER[b.gate];
  }
  // Higher score first; a null score (undecidable) sorts after any number.
  return (b.score ?? -1) - (a.score ?? -1);
}
