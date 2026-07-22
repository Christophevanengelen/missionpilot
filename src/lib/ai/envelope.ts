import "server-only";

import { z } from "zod";

/**
 * Runtime mirror of schemas/agent-output.schema.json (AgentOutputEnvelope).
 * EVERY model output crosses this boundary before any use: strict shapes,
 * closed enums, bounded confidence. Untrusted content in `data`/`warnings`
 * stays data — nothing in an envelope can alter rules, schemas or statuses.
 */

export const ENVELOPE_SCHEMA_VERSION = "1.0" as const;

export const envelopeEvidenceSchema = z.strictObject({
  claimKey: z.string(),
  referenceId: z.string(),
  support: z.enum(["strong", "partial", "contradictory"]),
});

export const ENVELOPE_STATUSES = [
  "completed",
  "needs_review",
  "failed",
] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

export function envelopeSchemaFor<DataSchema extends z.ZodType>(
  dataSchema: DataSchema,
) {
  return z.strictObject({
    schemaVersion: z.literal(ENVELOPE_SCHEMA_VERSION),
    status: z.enum(ENVELOPE_STATUSES),
    confidence: z.number().min(0).max(100),
    data: dataSchema,
    evidence: z.array(envelopeEvidenceSchema),
    warnings: z.array(z.string()),
  });
}

export type AgentOutputEnvelope<T> = {
  schemaVersion: typeof ENVELOPE_SCHEMA_VERSION;
  status: EnvelopeStatus;
  confidence: number;
  data: T;
  evidence: z.infer<typeof envelopeEvidenceSchema>[];
  warnings: string[];
};
