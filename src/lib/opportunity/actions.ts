"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { pastedImportSchema } from "@/domain/opportunity";
import * as opportunity from "./logic";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

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
): Promise<ActionResult<{ opportunityId: string }>> {
  try {
    const parsed = pastedImportSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const result = await opportunity.importPastedText(client, parsed.rawText);
    try {
      revalidatePath("/opportunities");
    } catch (error) {
      logger.error("opportunity revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, data: { opportunityId: result.opportunity_id } };
  } catch (error) {
    return sanitize("importPastedText", error);
  }
}
