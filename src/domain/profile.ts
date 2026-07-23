/**
 * Profile domain contracts — claim kinds, lifecycle state machine and value
 * schemas. Pure and framework-free (mirrors src/domain/run-state.ts): the
 * database CHECK constraints enforce the same vocabularies at the boundary.
 */
import { z } from "zod";

export const CLAIM_KINDS = [
  "role",
  "seniority",
  "summary",
  "years_experience",
  "skill",
  "achievement",
] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** Kinds that keep at most one active claim (DB partial unique index). */
export const SINGLE_VALUED_KINDS: readonly ClaimKind[] = [
  "role",
  "seniority",
  "summary",
  "years_experience",
];

export const CLAIM_STATES = [
  "proposed",
  "confirmed",
  "needs_review",
  "rejected",
] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

/**
 * Legal lifecycle transitions. Replacement is NOT a transition: a correction
 * creates a new claim and closes the old one (superseded_by/superseded_at).
 */
const CLAIM_TRANSITIONS: Record<ClaimState, readonly ClaimState[]> = {
  proposed: ["confirmed", "needs_review", "rejected"],
  needs_review: ["confirmed", "rejected"],
  confirmed: ["needs_review"],
  rejected: ["proposed"], // explicit "restore" of an ignored statement
};

export function canTransitionClaim(from: ClaimState, to: ClaimState): boolean {
  return CLAIM_TRANSITIONS[from].includes(to);
}

export function assertClaimTransition(from: ClaimState, to: ClaimState): void {
  if (!canTransitionClaim(from, to)) {
    throw new Error(`illegal claim transition: ${from} → ${to}`);
  }
}

// ---------------------------------------------------------------------------
// Claim value schemas (one shape per kind; values are append-only in DB).

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const claimValueSchemas = {
  role: z.object({ title: trimmed(200) }).strict(),
  seniority: z.object({ level: trimmed(100) }).strict(),
  summary: z.object({ text: trimmed(2000) }).strict(),
  years_experience: z
    .object({ years: z.number().int().min(0).max(80) })
    .strict(),
  skill: z.object({ name: trimmed(120) }).strict(),
  achievement: z
    .object({
      title: trimmed(300),
      statement: trimmed(2000).optional(),
    })
    .strict(),
} as const satisfies Record<ClaimKind, z.ZodTypeAny>;

export type ClaimValue<K extends ClaimKind> = z.infer<
  (typeof claimValueSchemas)[K]
>;

export function parseClaimValue(kind: ClaimKind, value: unknown) {
  return claimValueSchemas[kind].parse(value);
}

// ---------------------------------------------------------------------------
// Evidence vocabularies (mirror of the DB CHECKs).

export const EVIDENCE_TYPES = [
  "achievement",
  "responsibility",
  "skill",
  "domain",
  "metric",
  "testimonial",
  "credential",
  "portfolio_case",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "user_stated",
  "document",
  "url",
  "import",
] as const;

/** Verification levels a USER may set; `externally_verified` is reserved. */
export const USER_SETTABLE_VERIFICATION = [
  "imported",
  "user_confirmed",
] as const;

export const evidenceInputSchema = z
  .object({
    type: z.enum(EVIDENCE_TYPES),
    title: trimmed(300),
    statement: trimmed(5000),
    organization: trimmed(200).optional(),
    rolePlayed: trimmed(200).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    metrics: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    tags: z.array(trimmed(60)).max(20).default([]),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceReference: trimmed(1000).optional(),
    verificationStatus: z.enum(USER_SETTABLE_VERIFICATION),
  })
  .strict()
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, {
    message: "endDate must not precede startDate",
  });

export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

// ---------------------------------------------------------------------------
// Target preferences & hard constraints (PR E). These live on the profile
// itself (DOMAIN_MODEL.md): the user's CURRENT positioning, read live by the
// Phase 3 matching engine. Every field is optional — stating preferences is
// never required. The Zod bounds mirror the DB CHECK constraints exactly.

export const ENGAGEMENT_TYPES = [
  "freelance",
  "part_time",
  "interim",
  "permanent",
] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const REMOTE_POLICIES = [
  "remote_only",
  "remote_first",
  "hybrid",
  "onsite_ok",
] as const;
export type RemotePolicy = (typeof REMOTE_POLICIES)[number];

export const TRAVEL_TOLERANCES = ["none", "occasional", "frequent"] as const;
export type TravelTolerance = (typeof TRAVEL_TOLERANCES)[number];

export const BASE_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];

const stringList = (max: number) => z.array(trimmed(max)).max(20).default([]);
const dayRate = z.number().int().min(0).max(20000);

export const profilePreferencesSchema = z
  .object({
    targetRoleFamilies: stringList(120),
    preferredEngagementTypes: z
      .array(z.enum(ENGAGEMENT_TYPES))
      .max(20)
      .default([]),
    languages: stringList(120),
    allowedWorkRegions: stringList(120),
    hardExclusions: stringList(120),
    targetDayRate: dayRate.nullable().default(null),
    minimumDayRate: dayRate.nullable().default(null),
    baseCurrency: z.enum(BASE_CURRENCIES).nullable().default(null),
    remotePolicy: z.enum(REMOTE_POLICIES).nullable().default(null),
    timezoneOverlap: trimmed(120).nullable().default(null),
    travelTolerance: z.enum(TRAVEL_TOLERANCES).nullable().default(null),
  })
  .strict()
  .refine(
    (p) =>
      p.minimumDayRate === null ||
      p.targetDayRate === null ||
      p.minimumDayRate <= p.targetDayRate,
    {
      message: "minimumDayRate must not exceed targetDayRate",
      path: ["minimumDayRate"],
    },
  );

export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
