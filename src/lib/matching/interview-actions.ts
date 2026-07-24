"use server";

/**
 * On-demand interview-brief preparation for ONE opportunity (cost-bounded to a
 * single LLM call, freshness-aware). Produces preparation material the human
 * reviews. Honest outcomes: a specific reason when it cannot run.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOpportunity, getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { aiInterviewBrief, aiInterviewConfigured } from "./ai-interview";
import {
  buildOfferText,
  buildProfileDossier,
  insightInputHash,
} from "./insight-logic";
import { isBriefFresh, upsertBrief } from "./interview-logic";

const logger = createLogger({ module: "interview-actions" });

const inputSchema = z.object({ opportunityId: z.string().uuid() });

export type InterviewRunResult =
  | { ok: true; fresh: boolean }
  | {
      ok: false;
      error: "unconfigured" | "no_profile" | "not_found" | "generic";
    };

/** One brief run per (profile, opportunity) at a time. The lock is recorded in
 *  lockKey only AFTER it is acquired, so a busy short-circuit never releases
 *  another run's lock. */
const runsInFlight = new Set<string>();

export async function prepareInterviewAction(
  input: unknown,
): Promise<InterviewRunResult> {
  let lockKey: string | null = null;
  try {
    const { opportunityId } = inputSchema.parse(input);
    await verifySession();
    if (!aiInterviewConfigured()) return { ok: false, error: "unconfigured" };

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
    if (await isBriefFresh(client, profile.id, opportunityId, inputHash)) {
      return { ok: true, fresh: true };
    }

    const brief = await aiInterviewBrief(dossier, offerText);
    if (brief === null) return { ok: false, error: "generic" };

    await upsertBrief(client, profile.id, opportunityId, brief, inputHash);
    try {
      revalidatePath(`/opportunities/${opportunityId}`);
    } catch (error) {
      logger.error("brief revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, fresh: false };
  } catch (error) {
    logger.error("interview brief run failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  } finally {
    if (lockKey !== null) runsInFlight.delete(lockKey);
  }
}
