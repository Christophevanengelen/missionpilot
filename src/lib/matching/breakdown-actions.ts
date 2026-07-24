"use server";

/**
 * On-demand per-requirement match breakdown for ONE opportunity (the premium
 * "détail de correspondance" the user requests per offer they care about —
 * cost-bounded to a single LLM call, freshness-aware). Honest outcomes: a
 * specific reason when it cannot run; the deterministic score always stands.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOpportunity, getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { aiBreakdownConfigured, aiMatchBreakdown } from "./ai-breakdown";
import {
  buildOfferText,
  buildProfileDossier,
  insightInputHash,
} from "./insight-logic";
import { isBreakdownFresh, upsertBreakdown } from "./breakdown-logic";

const logger = createLogger({ module: "breakdown-actions" });

const inputSchema = z.object({
  opportunityId: z.string().uuid(),
});

export type BreakdownRunResult =
  | { ok: true; fresh: boolean }
  | {
      ok: false;
      error: "unconfigured" | "no_profile" | "not_found" | "generic";
    };

/** One analysis in flight per (profile, opportunity) — the button is
 *  client-guarded too, this bounds a double server hit. */
const runsInFlight = new Set<string>();

export async function explainBreakdownAction(
  input: unknown,
): Promise<BreakdownRunResult> {
  let lockKey: string | null = null;
  try {
    const { opportunityId } = inputSchema.parse(input);
    await verifySession();
    if (!aiBreakdownConfigured()) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await getOwnProfile(client);

    lockKey = `${profile.id}:${opportunityId}`;
    if (runsInFlight.has(lockKey)) return { ok: true, fresh: true };
    runsInFlight.add(lockKey);

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
    if (await isBreakdownFresh(client, profile.id, opportunityId, inputHash)) {
      return { ok: true, fresh: true };
    }

    const breakdown = await aiMatchBreakdown(dossier, offerText);
    if (breakdown === null) return { ok: false, error: "generic" };

    await upsertBreakdown(
      client,
      profile.id,
      opportunityId,
      breakdown,
      inputHash,
    );
    try {
      revalidatePath(`/opportunities/${opportunityId}`);
    } catch (error) {
      logger.error("breakdown revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, fresh: false };
  } catch (error) {
    logger.error("breakdown run failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  } finally {
    if (lockKey !== null) runsInFlight.delete(lockKey);
  }
}
