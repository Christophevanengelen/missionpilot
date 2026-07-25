import "server-only";

import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import {
  runMultiSourceDiscovery,
  type DiscoverySource,
  type SearchPlan,
} from "@/lib/discovery/plan";
import { normalizeDiscovered } from "@/lib/opportunity/logic";
import { evaluateHardConstraints } from "@/lib/matching/hard-constraints";
import { scoreMatch, type ProfileSignals } from "@/lib/matching/score";
import type { ProfilePreferences } from "@/domain/profile";
import type { MarketHit, MarketSearchResult } from "./types";

/**
 * Search the market as it stands RIGHT NOW, and write nothing.
 *
 * This is the product's centre of gravity. The existing discovery path imports
 * every ad it finds — immutable snapshot, permanent row — which builds an
 * archive: yesterday's offers and today's pile up together and the "instant T"
 * property is lost. A search engine answers a question and forgets; the user
 * keeps what they choose to keep.
 *
 * Everything else is reused rather than reinvented, so the honesty guarantees
 * hold identically on both paths: the same multi-source runner with per-search
 * isolation and cross-source dedup, the same normalizer, the same
 * hard-constraint gate, the same deterministic score.
 *
 * No request context, no session client, no I/O beyond the source calls — so
 * the very same function backs the on-login search AND the scheduled weekly
 * digest. A digest that searched differently from the screen would eventually
 * promise offers the app does not show.
 */

const EXCERPT_CHARS = 320;

function excerptOf(description: string | null): string | null {
  if (description === null) return null;
  const flat = description.replace(/\s+/g, " ").trim();
  if (flat === "") return null;
  return flat.length <= EXCERPT_CHARS
    ? flat
    : `${flat.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}

/**
 * One ad, normalized and judged in memory.
 *
 * Returns null when the ad cannot satisfy the domain contract — a single
 * malformed listing must cost us that listing, never the whole search.
 */
function toHit(
  ad: DiscoveredAd,
  sourceName: string,
  preferences: ProfilePreferences,
  signals: ProfileSignals,
): MarketHit | null {
  let normalized: ReturnType<typeof normalizeDiscovered>;
  try {
    normalized = normalizeDiscovered(ad);
  } catch {
    return null;
  }
  const n = normalized.normalized;
  const facts = {
    engagementType: n.engagementType,
    remoteType: n.remoteType,
    compensationMin: n.compensationMin,
    compensationMax: n.compensationMax,
    compensationCurrency: n.compensationCurrency,
    compensationPeriod: n.compensationPeriod,
    locationText: n.locationText,
    title: n.title,
    organization: n.organization,
    description: n.description,
    skills: n.skills,
    requirements: n.requirements,
    responsibilities: n.responsibilities,
  };
  return {
    // The provenance URL is the natural identity; a listing without one still
    // needs a stable key, and its verbatim text is what dedup already uses.
    key: ad.sourceUrl ?? ad.rawText,
    title: n.title,
    organization: n.organization,
    locationText: n.locationText,
    engagementType: n.engagementType,
    remoteType: n.remoteType,
    compensationMin: n.compensationMin,
    compensationMax: n.compensationMax,
    compensationCurrency: n.compensationCurrency,
    compensationPeriod: n.compensationPeriod,
    skills: n.skills,
    excerpt: excerptOf(n.description),
    sourceName,
    sourceUrl: ad.sourceUrl,
    gate: evaluateHardConstraints(preferences, facts).gate,
    score: scoreMatch(preferences, signals, facts).overall,
    unknowns: normalized.unknowns,
  };
}

export async function searchMarket(
  plans: readonly SearchPlan[],
  sources: readonly DiscoverySource<DiscoveredAd>[],
  preferences: ProfilePreferences,
  signals: ProfileSignals,
  onSearchError: (sourceName: string, plan: SearchPlan, error: unknown) => void,
): Promise<MarketSearchResult> {
  const { items, failedSources } = await runMultiSourceDiscovery<DiscoveredAd>(
    plans,
    sources,
    onSearchError,
  );
  const hits = items
    .map(({ ad, sourceName }) => toHit(ad, sourceName, preferences, signals))
    .filter((hit): hit is MarketHit => hit !== null);
  return {
    hits,
    failedSources,
    searchedSources: sources.map((s) => s.name),
  };
}
