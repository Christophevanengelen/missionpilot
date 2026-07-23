/**
 * Opportunity domain contracts (Phase 2). Pure and framework-free; the DB
 * CHECK constraints enforce the same vocabularies at the boundary (mirror of
 * the `opportunities` table).
 *
 * KEY SAFETY RULE (SECURITY_AND_COMPLIANCE.md): normalized fields produced by
 * ingestion are UNVERIFIED assertions derived from source text — never facts.
 * Pasted text is DATA, never instructions (prompt-injection boundary): the
 * extractor reads it structurally and can never be steered by its content.
 */
import { z } from "zod";

export const ENGAGEMENT_TYPES = [
  "freelance",
  "part_time",
  "interim",
  "permanent",
] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const REMOTE_TYPES = [
  "remote_only",
  "hybrid",
  "onsite",
  "unspecified",
] as const;
export type RemoteType = (typeof REMOTE_TYPES)[number];

export const COMP_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export const COMP_PERIODS = ["day", "hour", "month", "year"] as const;

export const RETRIEVAL_METHODS = ["paste", "url", "import"] as const;
export type RetrievalMethod = (typeof RETRIEVAL_METHODS)[number];

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const strList = (max: number) => z.array(trimmed(max)).max(50).default([]);

/**
 * The normalized shape ingestion produces from a source. Every field is
 * optional/nullable — the extractor states only what it can defensibly read
 * and lists the rest under `unknowns` (honest, never guessed).
 */
export const normalizedOpportunitySchema = z
  .object({
    title: trimmed(500).nullable().default(null),
    organization: trimmed(300).nullable().default(null),
    engagementType: z.enum(ENGAGEMENT_TYPES).nullable().default(null),
    seniority: trimmed(120).nullable().default(null),
    description: z.string().trim().max(20000).nullable().default(null),
    requirements: strList(500),
    responsibilities: strList(500),
    skills: strList(120),
    locationText: trimmed(300).nullable().default(null),
    remoteType: z.enum(REMOTE_TYPES).nullable().default(null),
    compensationMin: z
      .number()
      .int()
      .min(0)
      .max(100000000)
      .nullable()
      .default(null),
    compensationMax: z
      .number()
      .int()
      .min(0)
      .max(100000000)
      .nullable()
      .default(null),
    compensationCurrency: z.enum(COMP_CURRENCIES).nullable().default(null),
    compensationPeriod: z.enum(COMP_PERIODS).nullable().default(null),
    sourceName: trimmed(300).nullable().default(null),
    sourceUrl: trimmed(2000).nullable().default(null),
  })
  .strict()
  .refine(
    (o) =>
      o.compensationMin === null ||
      o.compensationMax === null ||
      o.compensationMin <= o.compensationMax,
    {
      message: "compensationMin must not exceed compensationMax",
      path: ["compensationMin"],
    },
  );

export type NormalizedOpportunity = z.infer<typeof normalizedOpportunitySchema>;

/** The full extraction result: normalized fields + honest unknowns. */
export type OpportunityExtraction = {
  normalized: NormalizedOpportunity;
  /** Field names the extractor could NOT determine from the source. */
  unknowns: string[];
};

/** The list of normalizable field keys (drives `unknowns` completeness). */
export const NORMALIZED_FIELDS = [
  "title",
  "organization",
  "engagementType",
  "seniority",
  "description",
  "requirements",
  "responsibilities",
  "skills",
  "locationText",
  "remoteType",
  "compensationMin",
  "compensationMax",
  "compensationCurrency",
  "compensationPeriod",
  "sourceName",
  "sourceUrl",
] as const;

export const pastedImportSchema = z
  .object({
    rawText: z.string().trim().min(1).max(100000),
  })
  .strict();

export type PastedImportInput = z.infer<typeof pastedImportSchema>;

/** URL import: a bounded URL string (validated structurally by the source
 *  policy, not z.url(), so the gate can return a specific honest reason) +
 *  the user-pasted text (no server-side fetch in this PR). */
export const urlImportSchema = z
  .object({
    url: z.string().trim().min(1).max(2000),
    rawText: z.string().trim().min(1).max(100000),
  })
  .strict();

export type UrlImportInput = z.infer<typeof urlImportSchema>;
