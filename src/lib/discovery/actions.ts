"use server";

/**
 * Auto-discovery action: build search plans from the profile (target métiers
 * first, confirmed role + skills as fallback — see `plan.ts`), query EVERY
 * configured legal source (Adzuna, France Travail, …), and run each ad through
 * the standard import pipeline (immutable snapshot, per-owner dedup, gate +
 * score on read). Honest outcomes: how many were new vs already known; a
 * specific reason when discovery cannot run.
 */
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { buildSearchPlans, runMultiSourceDiscovery } from "./plan";
import { configuredSources } from "./sources";
import * as opportunity from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";

const logger = createLogger({ module: "discovery-actions" });

export type DiscoveryResult =
  | {
      ok: true;
      found: number;
      imported: number;
      duplicates: number;
      /** Ads that individually failed to import (logged; the rest landed). */
      failed: number;
      /** Métier searches that errored while others succeeded — surfaced so a
       *  possibly-incomplete result is never presented as a complete one. */
      failedSearches: number;
      /** WHICH sources came up short, with their failure counts. Without the
       *  name, a partial failure is undiagnosable once several sources are
       *  configured: a broken credential and a source-side outage read the
       *  same. */
      failedSources: { name: string; failed: number }[];
    }
  | { ok: false; error: "unconfigured" | "no_keywords" | "generic" };

export async function discoverOpportunitiesAction(): Promise<DiscoveryResult> {
  try {
    await verifySession();
    const sources = configuredSources();
    if (sources.length === 0) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await opportunity.getOwnProfile(client);
    const living = await loadLivingProfile(client, profile.id);
    const prefs = await loadPreferences(client, profile.id);
    const plans = buildSearchPlans(living.claims, prefs.targetRoleFamilies);
    if (plans.length === 0) return { ok: false, error: "no_keywords" };

    // Per-search isolation + cross-source/cross-search dedup live in the
    // testable runner; only when EVERY search failed is the whole run an
    // error, and a partial failure count travels to the UI (honesty: never
    // present a possibly-incomplete result as a complete one).
    const { items, failedSearches, totalSearches, failedSources } =
      await runMultiSourceDiscovery<DiscoveredAd>(
        plans,
        sources,
        (sourceName, plan, error) => {
          logger.error("discovery search failed", {
            source: sourceName,
            mode: plan.mode,
            reason: error instanceof Error ? error.message : "unknown",
          });
        },
      );
    if (failedSearches === totalSearches)
      return { ok: false, error: "generic" };

    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    for (const { ad, sourceName } of items) {
      // Per-ad isolation: one malformed ad must not void the batch — the
      // successful imports are committed and reported honestly.
      try {
        const result = await opportunity.importDiscovered(
          client,
          ad,
          sourceName,
        );
        if (result.created) imported += 1;
        else duplicates += 1;
      } catch (error) {
        failed += 1;
        logger.error("discovered ad import failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    try {
      revalidatePath("/opportunities");
    } catch (error) {
      logger.error("discovery revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return {
      ok: true,
      found: items.length,
      imported,
      duplicates,
      failed,
      failedSearches,
      failedSources,
    };
  } catch (error) {
    logger.error("discovery failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}
