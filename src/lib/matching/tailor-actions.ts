"use server";

/**
 * On-demand application tailoring for ONE opportunity ("préparer ma
 * candidature" — cost-bounded to a single LLM call, freshness-aware). Produces
 * a DRAFT the human reviews and sends themselves; nothing is submitted. Honest
 * outcomes: a specific reason when it cannot run.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOpportunity, getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { aiTailorConfigured, aiTailorApplication } from "./ai-tailor";
import {
  buildOfferText,
  buildProfileDossier,
  insightInputHash,
} from "./insight-logic";
import { isDraftFresh, upsertDraft } from "./tailor-logic";

const logger = createLogger({ module: "tailor-actions" });

const inputSchema = z.object({ opportunityId: z.string().uuid() });

export type TailorRunResult =
  | { ok: true; fresh: boolean }
  | {
      ok: false;
      error: "unconfigured" | "no_profile" | "not_found" | "generic";
    };

/** One tailoring run per (profile, opportunity) at a time. Acquire the lock
 *  BEFORE recording it, so a busy short-circuit never releases another run's
 *  lock (the finally is a no-op while lockKey is null). */
const runsInFlight = new Set<string>();

export async function tailorApplicationAction(
  input: unknown,
): Promise<TailorRunResult> {
  let lockKey: string | null = null;
  try {
    const { opportunityId } = inputSchema.parse(input);
    await verifySession();
    if (!aiTailorConfigured()) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await getOwnProfile(client);

    const key = `${profile.id}:${opportunityId}`;
    if (runsInFlight.has(key)) return { ok: true, fresh: true };
    runsInFlight.add(key);
    lockKey = key;

    const opportunity = await getOpportunity(client, opportunityId);
    if (!opportunity || opportunity.profile_id !== profile.id) {
      return { ok: false, error: "not_found" };
    }

    const [living, preferences] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
    ]);
    const dossier = buildProfileDossier(living.claims, preferences);
    if (dossier === "") return { ok: false, error: "no_profile" };

    const offerText = buildOfferText({
      title: opportunity.title,
      organization: opportunity.organization,
      description: opportunity.description,
      skills: (opportunity.skills as string[]) ?? null,
      requirements: (opportunity.requirements as string[]) ?? null,
    });
    if (offerText.trim() === "") return { ok: false, error: "not_found" };

    const inputHash = insightInputHash(dossier, offerText);
    if (await isDraftFresh(client, profile.id, opportunityId, inputHash)) {
      return { ok: true, fresh: true };
    }

    const draft = await aiTailorApplication(dossier, offerText);
    if (draft === null) return { ok: false, error: "generic" };

    await upsertDraft(client, profile.id, opportunityId, draft, inputHash);
    try {
      revalidatePath(`/opportunities/${opportunityId}`);
    } catch (error) {
      logger.error("draft revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, fresh: false };
  } catch (error) {
    logger.error("tailor run failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  } finally {
    if (lockKey !== null) runsInFlight.delete(lockKey);
  }
}
