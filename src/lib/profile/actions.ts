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
  profilePreferencesSchema,
  type ClaimKind,
  type ClaimState,
} from "@/domain/profile";
import type { LivingState } from "./interview";
import {
  buildTestimonialEvidence,
  recommendationInputSchema,
} from "./recommendation";
import * as profile from "./logic";

export type ActionResult<T = undefined> =
  /** After a successful mutation the action re-reads the CANONICAL living
   *  state server-side and returns it (`snapshot`): the client renders
   *  directly from this return — user feedback never depends on an RSC
   *  patch being committed. `revalidated` reports the navigation-coherence
   *  revalidation (diagnostic only). */
  | { ok: true; data: T; snapshot?: LivingState; revalidated?: boolean }
  | { ok: false; error: string };

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
    // "layout", not the default "page": the profile has NESTED routes
    // (/profile/recommendations, /profile/history), and `revalidatePath` with
    // the default scope invalidates the exact path only. A recommendation added
    // on the nested page therefore left that page's cache intact, and the only
    // thing refreshing the screen was the client's own `router.refresh()` — a
    // race it lost on a slow machine, silently. The person filled a form, saw
    // no error, and saw nothing appear.
    revalidatePath("/profile", "layout");
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

/**
 * Serializable canonical projection of the living profile, re-read AFTER a
 * successful mutation — the single source the client renders from.
 */
async function loadSnapshot(
  client: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  action: string,
): Promise<LivingState | undefined> {
  // Post-commit READ: like revalidation, a failure here must never disguise
  // a committed mutation as ok:false — log it and return no snapshot; the
  // client then keeps its last rendered state (a real reload re-reads the
  // database).
  try {
    return await loadSnapshotInner(client, profileId);
  } catch (error) {
    logger.error("profile snapshot reload failed", {
      action,
      step: "loadSnapshot",
      mutation: "committed",
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      reason: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function loadSnapshotInner(
  client: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
): Promise<LivingState> {
  const living = await profile.loadLivingProfile(client, profileId);
  return {
    claims: living.claims.map((c) => ({
      id: c.id,
      kind: c.kind as ClaimKind,
      value: c.value as Record<string, unknown>,
      state: c.state as ClaimState,
    })),
    evidence: living.evidence.map((e) => ({
      id: e.id,
      title: e.title,
      statement: e.statement,
      role_played: e.role_played,
      verification_status: e.verification_status,
      state: e.state as ClaimState,
    })),
    links: living.links.map((l) => ({
      id: l.id,
      claim_id: l.claim_id,
      evidence_id: l.evidence_id,
    })),
  };
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
    const snapshot = await loadSnapshot(client, profileId, "submitClaim");
    const revalidated = revalidateProfile("submitClaim");
    return { ok: true, data: { claimId }, snapshot, revalidated };
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
    const { client, profileId } = await ownProfileClient();
    await profile.setClaimState(client, parsed.claimId, parsed.to);
    const snapshot = await loadSnapshot(client, profileId, "decideClaim");
    const revalidated = revalidateProfile("decideClaim");
    return { ok: true, data: undefined, snapshot, revalidated };
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
    const snapshot = await loadSnapshot(client, profileId, "createEvidence");
    const revalidated = revalidateProfile("createEvidence");
    return { ok: true, data: { evidenceId }, snapshot, revalidated };
  } catch (error) {
    return sanitize("createEvidence", error);
  }
}

/**
 * Add a received recommendation (peer proof) as a `testimonial` evidence item.
 * The user PASTES their own recommendation; the app never fetches/scrapes it.
 * The evidence type is fixed server-side to `testimonial`.
 */
export async function addRecommendationAction(
  input: unknown,
): Promise<ActionResult<{ evidenceId: string }>> {
  try {
    const parsed = recommendationInputSchema.parse(input);
    const evidence = evidenceInputSchema.parse(
      buildTestimonialEvidence(parsed),
    );
    const { client, profileId } = await ownProfileClient();
    const evidenceId = await profile.createEvidence(
      client,
      profileId,
      evidence,
    );
    const snapshot = await loadSnapshot(client, profileId, "addRecommendation");
    const revalidated = revalidateProfile("addRecommendation");
    return { ok: true, data: { evidenceId }, snapshot, revalidated };
  } catch (error) {
    return sanitize("addRecommendation", error);
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
    const { client, profileId } = await ownProfileClient();
    await profile.updateEvidence(client, parsed.evidenceId, parsed.input);
    const snapshot = await loadSnapshot(client, profileId, "updateEvidence");
    const revalidated = revalidateProfile("updateEvidence");
    return { ok: true, data: undefined, snapshot, revalidated };
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
    const { client, profileId } = await ownProfileClient();
    await profile.setEvidenceState(client, parsed.evidenceId, parsed.to);
    const snapshot = await loadSnapshot(client, profileId, "decideEvidence");
    const revalidated = revalidateProfile("decideEvidence");
    return { ok: true, data: undefined, snapshot, revalidated };
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
    const { client, profileId } = await ownProfileClient();
    const linkId = await profile.attachEvidence(
      client,
      parsed.claimId,
      parsed.evidenceId,
    );
    const snapshot = await loadSnapshot(client, profileId, "attachEvidence");
    const revalidated = revalidateProfile("attachEvidence");
    return { ok: true, data: { linkId }, snapshot, revalidated };
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
    const { client, profileId } = await ownProfileClient();
    await profile.detachEvidence(client, parsed.linkId, parsed.reason);
    const snapshot = await loadSnapshot(client, profileId, "detachEvidence");
    const revalidated = revalidateProfile("detachEvidence");
    return { ok: true, data: undefined, snapshot, revalidated };
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
    /** False = the SQL no-op guard fired (content already identical to the
     *  head) and NOTHING was mutated. The RPC has always returned this
     *  flag; dropping it here made the no-op indistinguishable from a real
     *  restore when the restored version's number differs from the head's
     *  (defect demonstrated by the PR C e2e — honest UI needs it). */
    created: boolean;
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
        created: result.created,
        missingEvidence: result.missing_evidence,
      },
    };
  } catch (error) {
    return sanitize("restoreVersion", error);
  }
}

export async function savePreferencesAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = profilePreferencesSchema.parse(input);
    const { client, profileId } = await ownProfileClient();
    await profile.savePreferences(client, profileId, parsed);
    const revalidated = revalidateProfile("savePreferences");
    return { ok: true, data: undefined, revalidated };
  } catch (error) {
    return sanitize("savePreferences", error);
  }
}
