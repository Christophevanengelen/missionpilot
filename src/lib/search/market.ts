import "server-only";

import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import {
  runMultiSourceDiscovery,
  type DiscoverySource,
  type SearchPlan,
} from "@/lib/discovery/plan";
import { normalizeDiscovered } from "@/lib/opportunity/logic";
import { mergeDuplicates } from "./dedupe";
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

/** Comparison form: accents and punctuation removed, spaces collapsed — so
 *  "Service-Designer" and "service designer" are the same phrase. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when one of the searched roles appears CONTIGUOUSLY in the title. */
function matchesPhrase(
  title: string | null,
  phrases: readonly string[],
): boolean {
  if (title === null) return false;
  const folded = fold(title);
  return phrases.some((p) => {
    const needle = fold(p);
    return needle !== "" && folded.includes(needle);
  });
}

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
  phrases: readonly string[],
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
  // The skills component carries the MATCHED skill names as evidence — the
  // falsifiable half of the match, and the only part a user can go and check
  // against the posting itself.
  const score = scoreMatch(preferences, signals, facts);
  const matchedSkills =
    score.components.find((c) => c.key === "skills")?.evidence ?? [];
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
    postedAt: ad.postedAt,
    sources: [{ name: sourceName, url: ad.sourceUrl }],
    sourceName,
    sourceUrl: ad.sourceUrl,
    gate: evaluateHardConstraints(preferences, facts).gate,
    score: score.overall,
    confidence: score.confidence,
    titlePhraseMatch: matchesPhrase(n.title, phrases),
    matchedSkills,
    demandedSkillCount: n.skills.length,
    unknowns: normalized.unknowns,
  };
}

/**
 * Assemble un résultat de marché à partir de sources DÉJÀ lancées.
 *
 * Le pendant de `lancerParSource` : celui-ci découpe, celui-là recolle. La
 * séparation existe pour que l'écran puisse afficher chaque plateforme dès
 * qu'elle répond, sans que l'ordre final en dépende.
 *
 * LA DÉDUPLICATION SE FAIT ICI, en parcourant les sources dans l'ordre où
 * l'appelant les a déclarées — jamais dans l'ordre où leurs réponses sont
 * arrivées. C'est ce qui garantit que deux recherches identiques rendent la
 * même liste : sans ça, le gagnant d'un doublon dépendrait de la latence
 * réseau du moment, et la liste se réordonnerait toute seule d'une visite à
 * l'autre.
 */
export function assemblerMarche(
  resultats: readonly {
    nom: string;
    ads: DiscoveredAd[];
    echecs: number;
    tentatives: number;
  }[],
  plans: readonly SearchPlan[],
  preferences: ProfilePreferences,
  signals: ProfileSignals,
): MarketSearchResult {
  const vus = new Set<string>();
  const hits: MarketHit[] = [];
  const phrases = plans.map((p) => p.keywords.join(" "));

  for (const resultat of resultats) {
    for (const ad of resultat.ads) {
      const cle = ad.sourceUrl ?? ad.rawText;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const hit = toHit(ad, resultat.nom, preferences, signals, phrases);
      if (hit !== null) hits.push(hit);
    }
  }

  return {
    // Rattrape ce que la clé de provenance ne peut pas voir : LA MÊME annonce
    // publiée par deux plateformes sous deux URL différentes.
    hits: mergeDuplicates(hits),
    failedSources: resultats
      .filter((r) => r.echecs > 0)
      .map((r) => ({ name: r.nom, failed: r.echecs, total: r.tentatives })),
    searchedSources: resultats.map((r) => r.nom),
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
  // The exact phrases the user searched for, to tell "the role is in the
  // title" from "the words happen to be in the title".
  const phrases = plans.map((p) => p.keywords.join(" "));
  const hits = items
    .map(({ ad, sourceName }) =>
      toHit(ad, sourceName, preferences, signals, phrases),
    )
    .filter((hit): hit is MarketHit => hit !== null);
  return {
    // The runner already deduped by provenance URL; this catches what that
    // cannot — the SAME posting published by two boards under two URLs.
    hits: mergeDuplicates(hits),
    failedSources,
    searchedSources: sources.map((s) => s.name),
  };
}
