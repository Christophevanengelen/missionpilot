"use server";

/**
 * Analysis action: judge the best-ranked opportunities against the confirmed
 * profile ("pourquoi ce match"), cost-bounded and freshness-aware (an offer
 * whose stored insight matches the current profile+ad pair is skipped).
 * Honest outcomes: how many were analyzed vs failed; a specific reason when
 * the analysis cannot run.
 */
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOwnProfile, listOpportunities } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
} from "./hard-constraints";
import { profileSignalsFromClaims, scoreMatch } from "./score";
import { compareRanked } from "./rank";
import { aiExplainMatch, aiInsightConfigured } from "./ai-insight";
import {
  buildOfferText,
  buildProfileDossier,
  isInsightFresh,
  loadInsights,
  pickInsightTargets,
  upsertInsight,
} from "./insight-logic";

const logger = createLogger({ module: "insight-actions" });

export type InsightRunResult =
  | {
      ok: true;
      /** Offers judged this run (0 = every judgeable offer was already
       *  covered by a fresh insight). */
      analyzed: number;
      /** Offers whose individual analysis failed (logged; the rest landed). */
      failed: number;
    }
  | {
      ok: false;
      error:
        "unconfigured" | "no_profile" | "no_candidates" | "busy" | "generic";
    };

/** One analysis run per profile at a time (single-instance beta): the button
 *  and the post-discovery auto-chain are independent entry points — without
 *  this, overlapping runs would double-spend the same judgements. */
const runsInFlight = new Set<string>();

export async function explainMatchesAction(): Promise<InsightRunResult> {
  let profileId: string | null = null;
  try {
    await verifySession();
    if (!aiInsightConfigured()) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await getOwnProfile(client);
    if (runsInFlight.has(profile.id)) return { ok: false, error: "busy" };
    runsInFlight.add(profile.id);
    profileId = profile.id;

    const [opportunities, preferences, living, insights] = await Promise.all([
      listOpportunities(client, profile.id),
      loadPreferences(client, profile.id),
      loadLivingProfile(client, profile.id),
      loadInsights(client, profile.id),
    ]);

    const dossier = buildProfileDossier(living.claims, preferences);
    if (dossier === "") return { ok: false, error: "no_profile" };

    // Same ranking as the inbox: the judged offers are the ones the user sees
    // first.
    const signals = profileSignalsFromClaims(living.claims);
    const ranked = opportunities
      .map((o) => {
        const facts = opportunityFactsFromRow(o);
        return {
          o,
          gate: evaluateHardConstraints(preferences, facts).gate,
          score: scoreMatch(preferences, signals, facts).overall,
        };
      })
      .sort(compareRanked)
      .map(({ o, gate }) => ({
        id: o.id,
        gate,
        offerText: buildOfferText({
          title: o.title,
          organization: o.organization,
          description: o.description,
          // jsonb columns arrive as Json — same cast convention as the inbox.
          skills: (o.skills as string[]) ?? null,
          requirements: (o.requirements as string[]) ?? null,
        }),
      }));

    const freshHashes = new Map(
      [...insights].map(([id, i]) => [id, i.input_hash]),
    );
    const targets = pickInsightTargets(ranked, freshHashes, dossier);
    if (targets.length === 0) {
      // Honesty: "everything already analyzed" is only true when at least one
      // offer was judgeable in the first place.
      const judgeable = ranked.some(
        (r) => r.gate !== "excluded" && r.offerText.trim() !== "",
      );
      return judgeable
        ? { ok: true, analyzed: 0, failed: 0 }
        : { ok: false, error: "no_candidates" };
    }

    let analyzed = 0;
    let failed = 0;
    for (const target of targets) {
      // Re-check freshness right before spending: a concurrent run may have
      // just judged this pair (shrinks the double-spend window to an instant).
      if (
        await isInsightFresh(
          client,
          profile.id,
          target.opportunityId,
          target.inputHash,
        )
      ) {
        continue;
      }
      // Per-offer isolation: one failed judgement must not void the batch.
      const insight = await aiExplainMatch(dossier, target.offerText);
      if (insight === null) {
        failed += 1;
        continue;
      }
      try {
        await upsertInsight(
          client,
          profile.id,
          target.opportunityId,
          insight,
          target.inputHash,
        );
        analyzed += 1;
      } catch (error) {
        failed += 1;
        logger.error("insight upsert failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    try {
      revalidatePath("/opportunities");
    } catch (error) {
      logger.error("insight revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, analyzed, failed };
  } catch (error) {
    logger.error("insight run failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "generic" };
  } finally {
    if (profileId !== null) runsInFlight.delete(profileId);
  }
}
