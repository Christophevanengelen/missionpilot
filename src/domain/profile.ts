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
