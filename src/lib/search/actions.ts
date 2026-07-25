"use server";

/**
 * Market search action — runs a search and returns results. It writes NOTHING,
 * so there is deliberately no `revalidatePath` here: nothing was persisted,
 * so there is no cache to bust. That absence is the point of the feature.
 */
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { buildSearchPlans, type SearchPlan } from "@/lib/discovery/plan";
import { configuredSources } from "@/lib/discovery/sources";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { searchMarket } from "./market";
import type { MarketSearchResult } from "./types";

const logger = createLogger({ module: "search-actions" });

const inputSchema = z.object({
  /** Free text. Empty means "use the métiers the validated CV analysis chose". */
  query: z.string().max(200).default(""),
});

export type MarketSearchActionResult =
  | { ok: true; result: MarketSearchResult }
  | {
      ok: false;
      error: "unconfigured" | "no_keywords" | "generic";
    };

/**
 * A typed query targets the JOB TITLE rather than ORing its words across the
 * whole ad: searching "service designer" as loose words returns everything
 * mentioning "service", which is noise, not a market view. Same rule the
 * métier plans already use.
 */
function planFromQuery(query: string): SearchPlan[] {
  return [{ keywords: [query], mode: "title" }];
}

export async function searchMarketAction(
  input: unknown,
): Promise<MarketSearchActionResult> {
  try {
    const parsed = inputSchema.parse(input);
    await verifySession();

    const sources = configuredSources();
    if (sources.length === 0) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await getOwnProfile(client);
    const [living, preferences] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
    ]);
    const signals = profileSignalsFromClaims(living.claims);

    const query = parsed.query.trim();
    const plans =
      query !== ""
        ? planFromQuery(query)
        : buildSearchPlans(living.claims, preferences.targetRoleFamilies);
    if (plans.length === 0) return { ok: false, error: "no_keywords" };

    const result = await searchMarket(
      plans,
      sources,
      preferences,
      signals,
      (sourceName, plan, error) => {
        logger.error("market search failed", {
          source: sourceName,
          mode: plan.mode,
          reason: error instanceof Error ? error.message : "unknown",
        });
      },
    );
    return { ok: true, result };
  } catch (error) {
    logger.error("market search errored", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}
