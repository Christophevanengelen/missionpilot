"use server";

/**
 * Application-tracking actions (CRM pipeline). Deterministic, owner-scoped: set
 * or move an opportunity's pipeline stage / note / follow-up, or remove it from
 * tracking. Every write verifies the session and goes through the RLS session
 * client. Nothing is sent anywhere — this is the user's own private board.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOpportunity, getOwnProfile } from "@/lib/opportunity/logic";
import { deleteTracking, TRACKING_STAGES, upsertTracking } from "./logic";

const logger = createLogger({ module: "tracking-actions" });

const setSchema = z.object({
  opportunityId: z.string().uuid(),
  stage: z.enum(TRACKING_STAGES),
  note: z.string().max(4000).default(""),
  // "" clears the follow-up; otherwise a plain calendar date (YYYY-MM-DD).
  followUpOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

const idSchema = z.object({ opportunityId: z.string().uuid() });

export type TrackingResult = { ok: true } | { ok: false; error: string };

export async function setTrackingAction(
  input: unknown,
): Promise<TrackingResult> {
  try {
    const parsed = setSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const profile = await getOwnProfile(client);
    // Ownership: the opportunity must be the caller's own (RLS-scoped read).
    const opportunity = await getOpportunity(client, parsed.opportunityId);
    if (!opportunity || opportunity.profile_id !== profile.id) {
      return { ok: false, error: "not_found" };
    }
    await upsertTracking(client, profile.id, {
      opportunityId: parsed.opportunityId,
      stage: parsed.stage,
      note: parsed.note,
      followUpOn: parsed.followUpOn,
    });
    revalidatePath(`/opportunities/${parsed.opportunityId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logger.error("set tracking failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}

export async function untrackAction(input: unknown): Promise<TrackingResult> {
  try {
    const { opportunityId } = idSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const profile = await getOwnProfile(client);
    await deleteTracking(client, profile.id, opportunityId);
    revalidatePath(`/opportunities/${opportunityId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logger.error("untrack failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}
