/**
 * Deterministic match scoring (Phase 3, PR 3). Pure and framework-free — no
 * I/O, no LLM (owner decision: deterministic scores first, computed on read).
 *
 * Given the profile's preferences + confirmed signals and an opportunity's
 * normalized facts, it produces per-component scores (0-100), an overall score,
 * and an honest CONFIDENCE that reflects how much of the picture was decidable.
 *
 * HONESTY RULE (same as the hard-constraint engine): a component that cannot be
 * decided from KNOWN data scores `null` and is EXCLUDED from the overall — never
 * a fabricated number. Confidence = share of components that could be scored.
 */
import type { ProfilePreferences } from "@/domain/profile";
import { canonicalizeSkill } from "@/domain/skill-aliases";
import type { OpportunityFacts } from "@/lib/matching/hard-constraints";

export const SCORE_COMPONENTS = [
  "skills",
  "rate",
  "remote",
  "engagement",
] as const;
export type ScoreComponentKey = (typeof SCORE_COMPONENTS)[number];

/** Relative weights (renormalized over the components actually scored). */
const WEIGHTS: Record<ScoreComponentKey, number> = {
  skills: 0.4,
  rate: 0.25,
  remote: 0.2,
  engagement: 0.15,
};

export type Confidence = "none" | "low" | "medium" | "high";

export type ScoreComponent = {
  key: ScoreComponentKey;
  /** 0-100, or null when undecidable from known data. */
  score: number | null;
  /** Supporting values (e.g. the matched skills) — evidence for the score. */
  evidence: string[];
};

export type MatchScore = {
  /** 0-100 weighted over scored components, or null if none were scorable. */
  overall: number | null;
  confidence: Confidence;
  components: ScoreComponent[];
};

/** The confirmed profile signals the scorer reads (beyond preferences). */
export type ProfileSignals = {
  /** Confirmed skill names from the living profile. */
  skills: string[];
};

/**
 * Share of the opportunity's demanded skills the profile covers. Only the
 * extracted skill tokens are the demand set (requirements are prose — not a
 * reliable token source). Undecidable (⇒ null) when either side is empty.
 */
function scoreSkills(
  signals: ProfileSignals,
  f: OpportunityFacts,
): ScoreComponent {
  // Canonicalize both sides so acronyms / variants / FR↔EN translations of the
  // SAME skill compare equal ("JS" ↔ "JavaScript", "gestion de projet" ↔
  // "project management") instead of undercounting a real match.
  const demand = f.skills.map(canonicalizeSkill).filter(Boolean);
  const have = new Set(signals.skills.map(canonicalizeSkill).filter(Boolean));
  if (demand.length === 0 || have.size === 0) {
    return { key: "skills", score: null, evidence: [] };
  }
  const demandSet = [...new Set(demand)];
  const matched = demandSet.filter((d) => have.has(d));
  const score = Math.round((100 * matched.length) / demandSet.length);
  // Evidence: the covered skills in the opportunity's original casing, each
  // once (a listing may repeat a skill / vary its case — de-dup by canonical
  // token so chips stay unique and keys never collide).
  const matchedSet = new Set(matched);
  const seen = new Set<string>();
  const evidence: string[] = [];
  for (const s of f.skills) {
    const n = canonicalizeSkill(s);
    if (matchedSet.has(n) && !seen.has(n)) {
      seen.add(n);
      evidence.push(s);
    }
  }
  return { key: "skills", score, evidence };
}

/**
 * How the offered rate compares to the target (or, absent a target, the
 * minimum). Comparable only for a day rate in the base currency — no FX/period
 * guessing. `null` otherwise.
 */
function scoreRate(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ScoreComponent {
  const reference = prefs.targetDayRate ?? prefs.minimumDayRate;
  if (reference === null || reference <= 0) {
    return { key: "rate", score: null, evidence: [] };
  }
  if (
    prefs.baseCurrency === null ||
    f.compensationPeriod !== "day" ||
    f.compensationCurrency !== prefs.baseCurrency
  ) {
    return { key: "rate", score: null, evidence: [] };
  }
  const min = f.compensationMin;
  const max = f.compensationMax;
  const offered = min !== null && max !== null ? (min + max) / 2 : (min ?? max); // single-sided: use the known bound
  if (offered === null) return { key: "rate", score: null, evidence: [] };
  const score = Math.max(
    0,
    Math.min(100, Math.round((100 * offered) / reference)),
  );
  return { key: "rate", score, evidence: [] };
}

/** Alignment of the opportunity's remote type with the profile's policy. */
function scoreRemote(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ScoreComponent {
  if (prefs.remotePolicy === null)
    return { key: "remote", score: null, evidence: [] };
  if (f.remoteType === null || f.remoteType === "unspecified") {
    return { key: "remote", score: null, evidence: [] };
  }
  // rows: policy → { opp remoteType: score }
  const table: Record<
    NonNullable<ProfilePreferences["remotePolicy"]>,
    Record<"remote_only" | "hybrid" | "onsite", number>
  > = {
    remote_only: { remote_only: 100, hybrid: 40, onsite: 0 },
    remote_first: { remote_only: 100, hybrid: 70, onsite: 30 },
    hybrid: { remote_only: 80, hybrid: 100, onsite: 60 },
    onsite_ok: { remote_only: 100, hybrid: 100, onsite: 100 },
  };
  const score = table[prefs.remotePolicy][f.remoteType];
  return { key: "remote", score, evidence: [] };
}

/** Whether the engagement type is among the preferred ones. */
function scoreEngagement(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ScoreComponent {
  if (
    prefs.preferredEngagementTypes.length === 0 ||
    f.engagementType === null
  ) {
    return { key: "engagement", score: null, evidence: [] };
  }
  const score = prefs.preferredEngagementTypes.includes(f.engagementType)
    ? 100
    : 0;
  return { key: "engagement", score, evidence: [] };
}

function confidenceOf(scoredCount: number, total: number): Confidence {
  if (scoredCount === 0) return "none";
  const ratio = scoredCount / total;
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

/**
 * Score an opportunity against the profile. Deterministic and honest: only
 * components decidable from known data contribute to `overall` (weights
 * renormalized over them); `confidence` reflects how many of the four
 * components were scorable.
 */
export function scoreMatch(
  prefs: ProfilePreferences,
  signals: ProfileSignals,
  facts: OpportunityFacts,
): MatchScore {
  const components: ScoreComponent[] = [
    scoreSkills(signals, facts),
    scoreRate(prefs, facts),
    scoreRemote(prefs, facts),
    scoreEngagement(prefs, facts),
  ];

  const scored = components.filter(
    (c): c is ScoreComponent & { score: number } => c.score !== null,
  );
  let overall: number | null = null;
  if (scored.length > 0) {
    const totalWeight = scored.reduce((s, c) => s + WEIGHTS[c.key], 0);
    const weighted = scored.reduce((s, c) => s + c.score * WEIGHTS[c.key], 0);
    overall = Math.round(weighted / totalWeight);
  }

  return {
    overall,
    confidence: confidenceOf(scored.length, components.length),
    components,
  };
}

/** Confirmed skill names from a living-profile claims array. */
export function profileSignalsFromClaims(
  claims: { kind: string; state: string; value: unknown }[],
): ProfileSignals {
  const skills = claims
    .filter((c) => c.kind === "skill" && c.state === "confirmed")
    .map((c) => (c.value as { name?: unknown })?.name)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return { skills };
}
