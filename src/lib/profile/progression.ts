import {
  DIGEST_THRESHOLD,
  SEARCH_THRESHOLD,
  type Readiness,
} from "./readiness";

/**
 * What the profile has already unlocked, and what the next rung buys.
 *
 * THE RULE: never a bare percentage. A number on its own is a verdict, and a
 * verdict is not what someone rebuilding their career needs from us. Worse, a
 * visible ceiling caps effort — people stop at "100%" and at "you're done".
 * So the profile always reads as *capabilities gained*, and the number, when
 * shown at all, sits behind the sentence rather than in front of it.
 *
 * EVERY TIER HERE IS A REAL GATE IN THE CODE. `search` is what
 * `assessReadiness` actually opens; `digest` is the threshold a weekly email
 * would actually require; `stepUp` is gated by the career reading having
 * enough scope to judge an altitude. Inventing a decorative milestone —
 * "Profil Or", "80% — presque là" — would be a progress bar pretending to be
 * a promise, and the first time someone crossed it and nothing changed, they
 * would be right never to trust the next one.
 */

export type TierKey = "search" | "stepUp" | "digest";

export type Tier = {
  key: TierKey;
  /** What this unlocks, said as a capability the person gains. */
  unlocks: string;
  reached: boolean;
};

export type Progression = {
  tiers: Tier[];
  /** The next unreached tier, or null when everything is unlocked. */
  next: Tier | null;
  /**
   * 0..100 — kept for the bar's WIDTH only, never rendered as a figure on its
   * own. The bar starts visibly filled rather than at zero: an effort already
   * begun is finished far more often than one shown as untouched.
   */
  fill: number;
};

/** The bar never starts empty. Two stamps on the card, before anything is
 *  asked, roughly doubles completion — and here it is not a trick: reading a
 *  CV genuinely is progress the person made. */
const FLOOR = 12;

export type AltitudeEvidence = {
  hasRole: boolean;
  hasSeniority: boolean;
  hasYears: boolean;
  achievementCount: number;
};

/**
 * Whether the record contains enough ALTITUDE for a career to be read as a
 * curve — a title, a level, a span of years, and at least one thing actually
 * accomplished.
 *
 * This replaces a genuine bug: the tier used to key off the readiness
 * `trajectory` ratio, which the dashboard sets to "complete" as soon as ANY
 * claim exists. A profile holding six skills and nothing else therefore
 * announced that the step up was unlocked — the decorative milestone this
 * module exists to refuse, shipped by the module itself. A tier must be
 * checkable against something real, or it is a promise we cannot keep.
 */
export function hasAltitudeEvidence(evidence: AltitudeEvidence): boolean {
  return (
    evidence.hasRole &&
    evidence.hasSeniority &&
    evidence.hasYears &&
    evidence.achievementCount >= 1
  );
}

export function progression(
  readiness: Readiness,
  evidence: AltitudeEvidence,
): Progression {
  const tiers: Tier[] = [
    {
      key: "search",
      unlocks: "je cherche pour vous à chaque connexion, sans rien demander",
      reached: readiness.canSearch,
    },
    {
      key: "stepUp",
      unlocks:
        "je peux viser la marche d'après — les postes d'un cran au-dessus, avec les preuves de votre parcours",
      // The staircase needs the career read as a CURVE, which needs altitude
      // in the record. A score alone never earns it.
      reached: hasAltitudeEvidence(evidence),
    },
    {
      key: "digest",
      unlocks:
        "je vous envoie ce que le marché a de neuf, sans que vous veniez",
      reached: readiness.canDigest,
    },
  ];

  return {
    tiers,
    next: tiers.find((t) => !t.reached) ?? null,
    fill: Math.min(
      100,
      FLOOR + Math.round((readiness.score * (100 - FLOOR)) / 100),
    ),
  };
}

/** The thresholds, exported so the UI can explain a gate without re-deriving
 *  it — one source of truth for a number the user is judged against. */
export const THRESHOLDS = {
  search: SEARCH_THRESHOLD,
  digest: DIGEST_THRESHOLD,
} as const;
