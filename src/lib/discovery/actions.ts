"use server";

/**
 * Auto-discovery action: derive search keywords from the CONFIRMED profile
 * (role + skills), query the configured legal source (Adzuna), and run each
 * ad through the standard import pipeline (immutable snapshot, per-owner
 * dedup, gate + score on read). Honest outcomes: how many were new vs
 * already known; a specific reason when discovery cannot run.
 */
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { adzunaConfigured, searchAdzuna } from "./adzuna";
import * as opportunity from "@/lib/opportunity/logic";
import { loadLivingProfile } from "@/lib/profile/logic";

const logger = createLogger({ module: "discovery-actions" });

export type DiscoveryResult =
  | { ok: true; found: number; imported: number; duplicates: number }
  | { ok: false; error: "unconfigured" | "no_keywords" | "generic" };

/** Keywords from the confirmed profile: the role title first, then skills. */
function deriveKeywords(
  claims: { kind: string; state: string; value: unknown }[],
): string[] {
  const confirmed = claims.filter((c) => c.state === "confirmed");
  const role = confirmed
    .filter((c) => c.kind === "role")
    .map((c) => (c.value as { title?: unknown })?.title)
    .find((v): v is string => typeof v === "string" && v.trim() !== "");
  const skills = confirmed
    .filter((c) => c.kind === "skill")
    .map((c) => (c.value as { name?: unknown })?.name)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return [...(role ? [role] : []), ...skills].slice(0, 4);
}

export async function discoverOpportunitiesAction(): Promise<DiscoveryResult> {
  try {
    await verifySession();
    if (!adzunaConfigured()) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await opportunity.getOwnProfile(client);
    const living = await loadLivingProfile(client, profile.id);
    const keywords = deriveKeywords(living.claims);
    if (keywords.length === 0) return { ok: false, error: "no_keywords" };

    const ads = await searchAdzuna(keywords);
    let imported = 0;
    let duplicates = 0;
    for (const ad of ads) {
      const result = await opportunity.importDiscovered(client, ad, "Adzuna");
      if (result.created) imported += 1;
      else duplicates += 1;
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
    return { ok: true, found: ads.length, imported, duplicates };
  } catch (error) {
    logger.error("discovery failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}
