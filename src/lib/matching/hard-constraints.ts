/**
 * Deterministic hard-constraint engine (Phase 3, PR 1). Pure and
 * framework-free — no I/O, no LLM. Given the profile's LIVE hard constraints
 * (P1 PR E) and an opportunity's normalized fields, it returns an honest
 * eligibility verdict with per-constraint reasons.
 *
 * HONESTY RULE (mirrors the ingestion contract): normalized fields are
 * UNVERIFIED assertions. When the data needed to decide a constraint is
 * missing, the verdict is `unknown` — NEVER a false `pass` or false
 * `violated`. Only KNOWN data can pass or violate a hard rule. Soft
 * preferences (target rate, role families, languages, timezone, travel) are
 * scoring-layer concerns and are intentionally NOT gated here.
 */
import {
  COMP_CURRENCIES,
  COMP_PERIODS,
  ENGAGEMENT_TYPES,
  REMOTE_TYPES,
  type EngagementType,
  type RemoteType,
} from "@/domain/opportunity";
import type { BaseCurrency, ProfilePreferences } from "@/domain/profile";

export type ConstraintVerdict =
  "pass" | "violated" | "unknown" | "not_constrained";

export type EligibilityGate = "eligible" | "review" | "excluded";

export const HARD_CONSTRAINT_KEYS = [
  "remote",
  "engagement_type",
  "minimum_day_rate",
  "hard_exclusions",
  "allowed_regions",
] as const;
export type HardConstraintKey = (typeof HARD_CONSTRAINT_KEYS)[number];

export type HardConstraintCheck = {
  key: HardConstraintKey;
  verdict: ConstraintVerdict;
  /** A matched value when relevant (e.g. the excluded term). */
  detail: string | null;
};

export type HardConstraintReport = {
  gate: EligibilityGate;
  checks: HardConstraintCheck[];
};

/** The minimal opportunity facts the engine reads (camelCase, validated). */
export type OpportunityFacts = {
  engagementType: EngagementType | null;
  remoteType: RemoteType | null;
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: BaseCurrency | null;
  compensationPeriod: (typeof COMP_PERIODS)[number] | null;
  locationText: string | null;
  title: string | null;
  organization: string | null;
  description: string | null;
  skills: string[];
  requirements: string[];
  responsibilities: string[];
};

// --- individual constraints -------------------------------------------------

/** Only `remote_only` is a HARD gate; other policies are soft (scoring). */
function checkRemote(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ConstraintVerdict {
  if (prefs.remotePolicy !== "remote_only") return "not_constrained";
  switch (f.remoteType) {
    case "remote_only":
      return "pass";
    case "onsite":
    case "hybrid":
      return "violated";
    default:
      return "unknown"; // "unspecified" | null
  }
}

function checkEngagement(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ConstraintVerdict {
  if (prefs.preferredEngagementTypes.length === 0) return "not_constrained";
  if (f.engagementType === null) return "unknown";
  return prefs.preferredEngagementTypes.includes(f.engagementType)
    ? "pass"
    : "violated";
}

/**
 * Currency/period-aware floor. Comparable only when the opportunity quotes a
 * DAY rate in the profile's base currency — no FX and no period conversion are
 * assumed (that would be a guess). Otherwise `unknown`.
 */
function checkMinimumDayRate(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ConstraintVerdict {
  if (prefs.minimumDayRate === null) return "not_constrained";
  if (prefs.baseCurrency === null) return "unknown";
  if (f.compensationPeriod !== "day") return "unknown";
  if (f.compensationCurrency !== prefs.baseCurrency) return "unknown";
  const hi = f.compensationMax ?? f.compensationMin;
  const lo = f.compensationMin ?? f.compensationMax;
  if (hi === null || lo === null) return "unknown";
  if (hi < prefs.minimumDayRate) return "violated"; // even best case below floor
  if (lo >= prefs.minimumDayRate) return "pass";
  return "unknown"; // the range straddles the floor
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, word-boundary match (Unicode-aware) so an exclusion of
 * "java" does not match "javascript". A violation EXCLUDES the opportunity, so
 * precision matters more than recall here.
 */
function matchesTerm(haystack: string, term: string): boolean {
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`,
    "iu",
  );
  return re.test(haystack);
}

function checkExclusions(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): { verdict: ConstraintVerdict; detail: string | null } {
  if (prefs.hardExclusions.length === 0) {
    return { verdict: "not_constrained", detail: null };
  }
  const haystack = [
    f.title,
    f.organization,
    f.description,
    f.locationText,
    ...f.skills,
    ...f.requirements,
    ...f.responsibilities,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n");
  if (!haystack) return { verdict: "unknown", detail: null }; // nothing to scan
  for (const raw of prefs.hardExclusions) {
    const term = raw.trim();
    if (term && matchesTerm(haystack, term)) {
      return { verdict: "violated", detail: term };
    }
  }
  return { verdict: "pass", detail: null };
}

/**
 * A region string appearing in the location ⇒ pass. Location present but no
 * match ⇒ `unknown`: free text cannot PROVE the location is OUTSIDE an allowed
 * region (e.g. "Lyon" vs ["France"]), so we never turn that into a violation.
 * The later LLM slice does real geographic reasoning.
 */
function checkRegions(
  prefs: ProfilePreferences,
  f: OpportunityFacts,
): ConstraintVerdict {
  if (prefs.allowedWorkRegions.length === 0) return "not_constrained";
  if (!f.locationText || !f.locationText.trim()) return "unknown";
  const loc = f.locationText.toLowerCase();
  for (const raw of prefs.allowedWorkRegions) {
    const region = raw.trim().toLowerCase();
    if (region && loc.includes(region)) return "pass";
  }
  return "unknown";
}

// --- aggregation ------------------------------------------------------------

/**
 * Evaluate every hard constraint and aggregate a gate: any `violated` ⇒
 * `excluded`; else any `unknown` ⇒ `review`; else ⇒ `eligible`.
 */
export function evaluateHardConstraints(
  prefs: ProfilePreferences,
  facts: OpportunityFacts,
): HardConstraintReport {
  const exclusions = checkExclusions(prefs, facts);
  const checks: HardConstraintCheck[] = [
    { key: "remote", verdict: checkRemote(prefs, facts), detail: null },
    {
      key: "engagement_type",
      verdict: checkEngagement(prefs, facts),
      detail: null,
    },
    {
      key: "minimum_day_rate",
      verdict: checkMinimumDayRate(prefs, facts),
      detail: null,
    },
    {
      key: "hard_exclusions",
      verdict: exclusions.verdict,
      detail: exclusions.detail,
    },
    {
      key: "allowed_regions",
      verdict: checkRegions(prefs, facts),
      detail: null,
    },
  ];

  const gate: EligibilityGate = checks.some((c) => c.verdict === "violated")
    ? "excluded"
    : checks.some((c) => c.verdict === "unknown")
      ? "review"
      : "eligible";

  return { gate, checks };
}

// --- DB row adapter ---------------------------------------------------------

/** The subset of an `opportunities` row the engine reads (snake_case). */
export type OpportunityRow = {
  engagement_type: string | null;
  remote_type: string | null;
  compensation_min: number | null;
  compensation_max: number | null;
  compensation_currency: string | null;
  compensation_period: string | null;
  location_text: string | null;
  title: string | null;
  organization: string | null;
  description: string | null;
  skills: unknown;
  requirements: unknown;
  responsibilities: unknown;
};

function asEnum<T extends readonly string[]>(
  allowed: T,
  v: string | null,
): T[number] | null {
  return v !== null && (allowed as readonly string[]).includes(v)
    ? (v as T[number])
    : null;
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

/**
 * Map a DB opportunity row to validated engine facts. Enum-typed columns are
 * checked against their vocabularies (an out-of-vocabulary value becomes
 * `null`, i.e. unknown) so a corrupt row can never fabricate a pass/violation.
 */
export function opportunityFactsFromRow(row: OpportunityRow): OpportunityFacts {
  return {
    engagementType: asEnum(ENGAGEMENT_TYPES, row.engagement_type),
    remoteType: asEnum(REMOTE_TYPES, row.remote_type),
    compensationMin: row.compensation_min,
    compensationMax: row.compensation_max,
    compensationCurrency: asEnum(COMP_CURRENCIES, row.compensation_currency),
    compensationPeriod: asEnum(COMP_PERIODS, row.compensation_period),
    locationText: row.location_text,
    title: row.title,
    organization: row.organization,
    description: row.description,
    skills: asStringList(row.skills),
    requirements: asStringList(row.requirements),
    responsibilities: asStringList(row.responsibilities),
  };
}
