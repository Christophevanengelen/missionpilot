/**
 * How ready a profile is to be worked FOR — and what is missing.
 *
 * Deterministic and pure: no model decides whether someone gets searched for.
 * A score that moved because a language model felt differently today would be
 * unexplainable to the person it judges, and this number gates real things —
 * the automatic search on every visit, and eventually a weekly email.
 *
 * THE DESIGN RULE: every dimension answers "what does the engine become unable
 * to do without this?" A field that changes nothing is not scored, however
 * tempting a fuller-looking form is. Asking for something we will not use is
 * the fastest way to teach someone their answers do not matter.
 *
 * The score is never shown as a bare percentage. It is always paired with the
 * single next thing to do — a number without a next step is a judgement, and a
 * judgement is not what someone rebuilding their career needs from us.
 */

export const DIMENSIONS = [
  "identity",
  "skills",
  "scope",
  "trajectory",
  "proof",
] as const;
export type ReadinessDimension = (typeof DIMENSIONS)[number];

/**
 * Weights follow consequence, not effort.
 *
 * Identity and skills are what a search is BUILT from — without them there is
 * no query and nothing to match, so they carry the most. Scope decides whether
 * results are filtered honestly. Trajectory is what unlocks the step up, which
 * is the product's distinctive promise but not its precondition. Proof carries
 * least here because recommendations strengthen an application rather than a
 * search — they matter enormously, later.
 */
const WEIGHTS: Record<ReadinessDimension, number> = {
  identity: 0.3,
  skills: 0.3,
  scope: 0.2,
  trajectory: 0.15,
  proof: 0.05,
};

export type DimensionState = {
  key: ReadinessDimension;
  /** 0..1 — how much of this dimension is satisfied. */
  ratio: number;
  /** What the engine cannot do while this is incomplete. Never a scold. */
  missing: string[];
};

export type Readiness = {
  /** 0..100, rounded. */
  score: number;
  dimensions: DimensionState[];
  /**
   * Enough to search FOR the user without being asked.
   *
   * Set at the point where a search stops being noise: an identity to query
   * with and skills to match against. Waiting for a perfect profile before
   * showing anything would hide the product behind a form — and the first
   * result is what makes someone want to complete the rest.
   */
  canSearch: boolean;
  /**
   * Enough to put results in someone's inbox unprompted.
   *
   * Deliberately higher than `canSearch`. A search the user triggered can
   * disappoint; an email that disappoints trains them to ignore us, and there
   * is no second chance at that.
   */
  canDigest: boolean;
};

export const SEARCH_THRESHOLD = 40;
export const DIGEST_THRESHOLD = 75;

export type ReadinessInput = {
  /** Confirmed claims only — a proposed claim is not a fact about the user. */
  confirmedClaims: readonly { kind: string; value: unknown }[];
  preferences: {
    targetRoleFamilies: readonly string[];
    allowedWorkRegions: readonly string[];
    preferredEngagementTypes: readonly string[];
    remotePolicy: string | null;
  };
  /** Recommendations recorded as testimonial evidence. */
  testimonialCount: number;
  /**
   * Questions the career reading could not answer from the dossier. Their
   * presence IS the trajectory gap — we do not guess at what is missing, the
   * analysis tells us.
   */
  openTrajectoryQuestions: number;
};

function has(claims: ReadinessInput["confirmedClaims"], kind: string): boolean {
  return claims.some((c) => c.kind === kind);
}

function countKind(
  claims: ReadinessInput["confirmedClaims"],
  kind: string,
): number {
  return claims.filter((c) => c.kind === kind).length;
}

/** Enough confirmed skills for a match to mean something. Below this, an
 *  overlap is a coincidence rather than a signal. */
const MIN_SKILLS = 5;

export function assessReadiness(input: ReadinessInput): Readiness {
  const { confirmedClaims: claims, preferences: prefs } = input;

  const identityParts = [
    { ok: has(claims, "role"), miss: "votre rôle" },
    { ok: has(claims, "seniority"), miss: "votre niveau de séniorité" },
    { ok: has(claims, "years_experience"), miss: "vos années d'expérience" },
  ];
  const identity: DimensionState = {
    key: "identity",
    ratio: identityParts.filter((p) => p.ok).length / identityParts.length,
    missing: identityParts.filter((p) => !p.ok).map((p) => p.miss),
  };

  const skillCount = countKind(claims, "skill");
  const skills: DimensionState = {
    key: "skills",
    ratio: Math.min(1, skillCount / MIN_SKILLS),
    missing:
      skillCount >= MIN_SKILLS
        ? []
        : [`${MIN_SKILLS - skillCount} compétence(s) confirmée(s) de plus`],
  };

  const scopeParts = [
    { ok: prefs.targetRoleFamilies.length > 0, miss: "les métiers visés" },
    {
      ok: prefs.allowedWorkRegions.length > 0,
      miss: "où vous acceptez de travailler",
    },
    { ok: prefs.remotePolicy !== null, miss: "votre rapport au télétravail" },
    {
      ok: prefs.preferredEngagementTypes.length > 0,
      miss: "le type d'engagement recherché",
    },
  ];
  const scope: DimensionState = {
    key: "scope",
    ratio: scopeParts.filter((p) => p.ok).length / scopeParts.length,
    missing: scopeParts.filter((p) => !p.ok).map((p) => p.miss),
  };

  // The career reading tells us what it could not settle. An open question is
  // exactly one unit of missing trajectory — no more, no less.
  const open = Math.max(0, input.openTrajectoryQuestions);
  const trajectory: DimensionState = {
    key: "trajectory",
    ratio: open === 0 ? 1 : Math.max(0, 1 - open / 3),
    missing:
      open === 0 ? [] : [`${open} précision(s) sur l'ampleur de vos missions`],
  };

  const proof: DimensionState = {
    key: "proof",
    ratio: Math.min(1, input.testimonialCount / 2),
    missing:
      input.testimonialCount >= 2
        ? []
        : ["une recommandation d'un ancien collègue ou client"],
  };

  const dimensions = [identity, skills, scope, trajectory, proof];
  const score = Math.round(
    dimensions.reduce((sum, d) => sum + d.ratio * WEIGHTS[d.key], 0) * 100,
  );

  return {
    score,
    dimensions,
    // A search needs something to query with AND something to match against.
    // Scoring well on scope alone must never unlock it: filters over an empty
    // profile return a tidy list of irrelevance.
    canSearch:
      score >= SEARCH_THRESHOLD && identity.ratio > 0 && skills.ratio > 0,
    canDigest: score >= DIGEST_THRESHOLD,
  };
}

/**
 * The single next thing to do, or null when nothing is missing.
 *
 * One at a time, in weight order: a list of eight gaps is a wall, and a wall is
 * where people stop. The heaviest incomplete dimension is also the one whose
 * answer buys the most, so this ordering is honest as well as kind.
 */
export function nextStep(readiness: Readiness): {
  dimension: ReadinessDimension;
  ask: string;
} | null {
  const incomplete = readiness.dimensions
    .filter((d) => d.missing.length > 0)
    .sort((a, b) => WEIGHTS[b.key] - WEIGHTS[a.key]);
  const first = incomplete[0];
  return first ? { dimension: first.key, ask: first.missing[0] } : null;
}
