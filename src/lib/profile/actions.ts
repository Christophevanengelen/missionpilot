"use server";

/**
 * Server Actions for the profile/evidence vertical. Every action:
 *   1. verifies the session at the DAL (the real boundary);
 *   2. resolves the caller's OWN profile (session client — RLS in force);
 *   3. Zod-validates its input;
 *   4. delegates to the pure logic layer;
 *   5. returns a sanitized result (never provider internals).
 *
 * PR A ships the actions without any business UI; PR B binds them.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import {
  CLAIM_KINDS,
  CLAIM_STATES,
  evidenceInputSchema,
} from "@/domain/profile";
import * as profile from "./logic";

export type ActionResult<T = undefined> =
  /** `revalidated` is false when the business mutation SUCCEEDED but the
   *  UI revalidation step failed — the client then (and only then) falls
   *  back to a single explicit router.refresh(). */
  { ok: true; data: T; revalidated?: boolean } | { ok: false; error: string };

const GENERIC_ERROR =
  "L'opération n'a pas abouti. Vos données n'ont pas été modifiées — réessayez.";

/**
 * Revalidate the profile surface after a SUCCESSFUL visible mutation.
 * STRICTLY separated from the business mutation: once the mutation is
 * committed, a revalidation exception must NEVER surface as a mutation
 * failure. The exact failure is logged (action, step, error type/message,
 * mutation status) with no user content and no secret; the caller receives
 * `revalidated: false` so the client can fall back explicitly.
 */
function revalidateProfile(action: string): boolean {
  try {
    revalidatePath("/profile");
    return true;
  } catch (error) {
    logger.error("profile revalidation failed", {
      action,
      step: "revalidatePath",
      mutation: "committed",
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      reason: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function ownProfileClient() {
  await verifySession();
  const client = await createClient();
  const own = await profile.getOwnProfile(client);
  return { client, profileId: own.id };
}

const logger = createLogger({ module: "profile-actions" });

function sanitize(step: string, error: unknown): { ok: false; error: string } {
  logger.error("profile action failed", {
    step,
    reason: error instanceof Error ? error.message : "unknown",
  });
  return { ok: false, error: GENERIC_ERROR };
}

const uuid = z.uuid();

const submitClaimSchema = z.object({
  kind: z.enum(CLAIM_KINDS),
  value: z.unknown(),
  claimToSupersede: uuid.optional(),
});

export async function submitClaimAction(
  input: z.infer<typeof submitClaimSchema>,
): Promise<ActionResult<{ claimId: string }>> {
  try {
    const parsed = submitClaimSchema.parse(input);
    const { client, profileId } = await ownProfileClient();
    const claimId = await profile.submitClaim(
      client,
      profileId,
      parsed.kind,
      parsed.value,
      { origin: "user", claimToSupersede: parsed.claimToSupersede },
    );
    const revalidated = revalidateProfile("submitClaim");
    return { ok: true, data: { claimId }, revalidated };
  } catch (error) {
    return sanitize("submitClaim", error);
  }
}

const decideClaimSchema = z.object({
  claimId: uuid,
  to: z.enum(CLAIM_STATES),
});

export async function decideClaimAction(
  input: z.infer<typeof decideClaimSchema>,
): Promise<ActionResult> {
  try {
    const parsed = decideClaimSchema.parse(input);
    const { client } = await ownProfileClient();
    await profile.setClaimState(client, parsed.claimId, parsed.to);
    const revalidated = revalidateProfile("decideClaim");
    return { ok: true, data: undefined, revalidated };
  } catch (error) {
    return sanitize("decideClaim", error);
  }
}

export async function createEvidenceAction(
  input: unknown,
): Promise<ActionResult<{ evidenceId: string }>> {
  try {
    const parsed = evidenceInputSchema.parse(input);
    const { client, profileId } = await ownProfileClient();
    const evidenceId = await profile.createEvidence(client, profileId, parsed);
    const revalidated = revalidateProfile("createEvidence");
    return { ok: true, data: { evidenceId }, revalidated };
  } catch (error) {
    return sanitize("createEvidence", error);
  }
}

const updateEvidenceSchema = z.object({
  evidenceId: uuid,
  input: evidenceInputSchema,
});

export async function updateEvidenceAction(
  input: z.infer<typeof updateEvidenceSchema>,
): Promise<ActionResult> {
  try {
    const parsed = updateEvidenceSchema.parse(input);
    const { client } = await ownProfileClient();
    await profile.updateEvidence(client, parsed.evidenceId, parsed.input);
    const revalidated = revalidateProfile("updateEvidence");
    return { ok: true, data: undefined, revalidated };
  } catch (error) {
    return sanitize("updateEvidence", error);
  }
}

const decideEvidenceSchema = z.object({
  evidenceId: uuid,
  to: z.enum(CLAIM_STATES),
});

export async function decideEvidenceAction(
  input: z.infer<typeof decideEvidenceSchema>,
): Promise<ActionResult> {
  try {
    const parsed = decideEvidenceSchema.parse(input);
    const { client } = await ownProfileClient();
    await profile.setEvidenceState(client, parsed.evidenceId, parsed.to);
    const revalidated = revalidateProfile("decideEvidence");
    return { ok: true, data: undefined, revalidated };
  } catch (error) {
    return sanitize("decideEvidence", error);
  }
}

const linkSchema = z.object({ claimId: uuid, evidenceId: uuid });

export async function attachEvidenceAction(
  input: z.infer<typeof linkSchema>,
): Promise<ActionResult<{ linkId: string }>> {
  try {
    const parsed = linkSchema.parse(input);
    const { client } = await ownProfileClient();
    const linkId = await profile.attachEvidence(
      client,
      parsed.claimId,
      parsed.evidenceId,
    );
    const revalidated = revalidateProfile("attachEvidence");
    return { ok: true, data: { linkId }, revalidated };
  } catch (error) {
    return sanitize("attachEvidence", error);
  }
}

const detachSchema = z.object({
  linkId: uuid,
  reason: z.string().trim().min(1).max(500).optional(),
});

export async function detachEvidenceAction(
  input: z.infer<typeof detachSchema>,
): Promise<ActionResult> {
  try {
    const parsed = detachSchema.parse(input);
    const { client } = await ownProfileClient();
    await profile.detachEvidence(client, parsed.linkId, parsed.reason);
    const revalidated = revalidateProfile("detachEvidence");
    return { ok: true, data: undefined, revalidated };
  } catch (error) {
    return sanitize("detachEvidence", error);
  }
}

export async function publishVersionAction(): Promise<
  ActionResult<{
    versionId: string;
    versionNumber: number;
    created: boolean;
    summary: string;
  }>
> {
  try {
    const { client, profileId } = await ownProfileClient();
    const result = await profile.publishVersion(client, profileId);
    return {
      ok: true,
      data: {
        versionId: result.version_id,
        versionNumber: result.version_number,
        created: result.created,
        summary: result.summary,
      },
    };
  } catch (error) {
    return sanitize("publishVersion", error);
  }
}

const restoreSchema = z.object({ versionId: uuid });

export async function restoreVersionAction(
  input: z.infer<typeof restoreSchema>,
): Promise<
  ActionResult<{
    versionId: string;
    versionNumber: number;
    missingEvidence: number;
  }>
> {
  try {
    const parsed = restoreSchema.parse(input);
    const { client, profileId } = await ownProfileClient();
    const result = await profile.restoreVersion(
      client,
      profileId,
      parsed.versionId,
    );
    return {
      ok: true,
      data: {
        versionId: result.version_id,
        versionNumber: result.version_number,
        missingEvidence: result.missing_evidence,
      },
    };
  } catch (error) {
    return sanitize("restoreVersion", error);
  }
}
