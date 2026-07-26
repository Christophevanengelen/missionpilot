"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { pastedImportSchema, urlImportSchema } from "@/domain/opportunity";
import { classifySource, type SourceBlockedReason } from "./source-policy";
import * as opportunity from "./logic";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

/**
 * The outcome the client needs to report import status honestly. `created`
 * is false when the canonical fingerprint matched an existing opportunity and
 * only a new immutable snapshot was appended (duplicate detection).
 */
export type ImportOutcome = { opportunityId: string; created: boolean };

const GENERIC_ERROR =
  "L'import n'a pas abouti. Vérifiez le texte collé et réessayez.";

const logger = createLogger({ module: "opportunity-actions" });

function sanitize(step: string, error: unknown): { ok: false; error: string } {
  logger.error("opportunity action failed", {
    step,
    reason: error instanceof Error ? error.message : "unknown",
  });
  return { ok: false, error: GENERIC_ERROR };
}

/**
 * Import pasted source text into an owned opportunity + immutable snapshot.
 * The pasted text is untrusted DATA: it is normalized structurally and never
 * interpreted as instructions. Returns the new opportunity id so the client
 * can navigate to its inspection screen.
 */
export async function importPastedTextAction(
  input: unknown,
): Promise<ActionResult<ImportOutcome>> {
  try {
    const parsed = pastedImportSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const result = await opportunity.importPastedText(client, parsed.rawText);
    try {
      revalidatePath("/dashboard");
    } catch (error) {
      logger.error("opportunity revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return {
      ok: true,
      data: { opportunityId: result.opportunity_id, created: result.created },
    };
  } catch (error) {
    return sanitize("importPastedText", error);
  }
}

/**
 * Import from a source URL. The URL is classified by the source policy —
 * a blocked source returns a SPECIFIC honest reason (not the generic error).
 * NO server-side fetch happens (owner decision): the user pastes the text,
 * and the URL is recorded as provenance.
 */
export type UrlImportResult =
  | { ok: true; data: ImportOutcome }
  | { ok: false; error: string; blockedReason?: SourceBlockedReason };

export async function importFromUrlAction(
  input: unknown,
): Promise<UrlImportResult> {
  try {
    const parsed = urlImportSchema.parse(input);
    const policy = classifySource(parsed.url);
    if (policy.decision === "blocked") {
      // A blocked source is an expected, user-facing outcome — not an error.
      return { ok: false, error: "blocked", blockedReason: policy.reason };
    }
    await verifySession();
    const client = await createClient();
    const result = await opportunity.importFromUrl(
      client,
      parsed.url,
      parsed.rawText,
    );
    try {
      revalidatePath("/dashboard");
    } catch (error) {
      logger.error("opportunity revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return {
      ok: true,
      data: { opportunityId: result.opportunity_id, created: result.created },
    };
  } catch (error) {
    return sanitize("importFromUrl", error);
  }
}
