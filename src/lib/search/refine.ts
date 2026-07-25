/**
 * Refining a market search: filters and sorting, PURE and free of `server-only`
 * so the same code runs on the server for a pre-filtered search and in the
 * browser to re-filter results already on screen — instantly, with no round
 * trip. The owner asked for both: "soit mettre des filtres avant la recherche,
 * soit la recherche a déjà donné plein de résultats, et il peut les filtrer".
 *
 * THE RULE THAT SHAPES THIS FILE: most offers do not state most criteria.
 * A real production offer (Schneider Electric, via Adzuna) had engagement type,
 * seniority, remote mode AND compensation all undetermined — ten unknown
 * fields. A filter that silently dropped unstated values would empty the list
 * and hide good offers whose only fault is a terse source. So every filter is
 * three-state — matches / does not match / the source did not say — and
 * unstated offers are KEPT by default, for the UI to label as such. The engine
 * never turns "I don't know" into "no".
 */

import type { EngagementType, RemoteType } from "@/domain/opportunity";
import type { MarketHit } from "./types";

export type MarketFilters = {
  /** Engagement types to keep. Empty = this criterion is not constrained. */
  engagementTypes: readonly EngagementType[];
  /** Remote modes to keep. Empty = not constrained. */
  remoteTypes: readonly RemoteType[];
  /** Country/place terms matched against the offer's stated location.
   *  Empty = not constrained. */
  countries: readonly string[];
  /**
   * Keep offers whose value for a CONSTRAINED criterion is unstated.
   * Defaults to true everywhere it is built — see the file header. Turning it
   * off is a deliberate "only offers that say so", never the silent default.
   */
  includeUnstated: boolean;
};

export const NO_FILTERS: MarketFilters = {
  engagementTypes: [],
  remoteTypes: [],
  countries: [],
  includeUnstated: true,
};

/** Case- and accent-insensitive, so "Belgique" matches "belgique" and
 *  "Ile-de-France" matches "Île-de-France". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Whether an offer passes one criterion.
 *
 * `value === null` means the source did not say — the only case where
 * `includeUnstated` decides. It is NOT the same as "does not match", and
 * collapsing the two is the mistake this function exists to prevent.
 */
function passes<T>(
  value: T | null,
  wanted: readonly T[],
  includeUnstated: boolean,
): boolean {
  if (wanted.length === 0) return true;
  if (value === null) return includeUnstated;
  return wanted.includes(value);
}

/** Location is free text ("Paris, Ile-de-France", "France, Belgium"), so a
 *  country match is a substring test — approximate by nature, which is why an
 *  offer with no stated location falls under `includeUnstated` rather than
 *  being ruled out. */
function passesCountry(
  locationText: string | null,
  countries: readonly string[],
  includeUnstated: boolean,
): boolean {
  if (countries.length === 0) return true;
  if (locationText === null || locationText.trim() === "")
    return includeUnstated;
  const haystack = fold(locationText);
  return countries.some((c) => {
    const needle = fold(c);
    return needle !== "" && haystack.includes(needle);
  });
}

export function filterHits(
  hits: readonly MarketHit[],
  filters: MarketFilters,
): MarketHit[] {
  return hits.filter(
    (h) =>
      passes(
        h.engagementType,
        filters.engagementTypes,
        filters.includeUnstated,
      ) &&
      passes(h.remoteType, filters.remoteTypes, filters.includeUnstated) &&
      passesCountry(h.locationText, filters.countries, filters.includeUnstated),
  );
}

/** How many of the currently shown hits are unstated on a constrained
 *  criterion — so the UI can say "dont N non précisées" instead of pretending
 *  the list is a clean answer. */
export function unstatedCount(
  hits: readonly MarketHit[],
  filters: MarketFilters,
): number {
  return hits.filter(
    (h) =>
      (filters.engagementTypes.length > 0 && h.engagementType === null) ||
      (filters.remoteTypes.length > 0 && h.remoteType === null) ||
      (filters.countries.length > 0 &&
        (h.locationText === null || h.locationText.trim() === "")),
  ).length;
}

export const SORT_KEYS = [
  "relevance",
  "compensation",
  "organization",
  "title",
  "source",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export type MarketSort = { key: SortKey; direction: SortDirection };
export const DEFAULT_SORT: MarketSort = {
  key: "relevance",
  direction: "desc",
};

/** The comparable value for a sort key, or null when the offer does not carry
 *  it. Nulls never win a comparison — see `sortHits`. */
function sortValue(hit: MarketHit, key: SortKey): number | string | null {
  switch (key) {
    case "relevance":
      return hit.score;
    case "compensation":
      // The upper bound is what a reader compares on; fall back to the lower
      // bound so a single-figure offer still sorts.
      return hit.compensationMax ?? hit.compensationMin;
    case "organization":
      return hit.organization === null ? null : fold(hit.organization);
    case "title":
      return hit.title === null ? null : fold(hit.title);
    case "source":
      return fold(hit.sourceName);
  }
}

/**
 * Sort by any key, in either direction — the owner's "réassortir la liste en
 * mettant ce qu'il veut en premier et en dernier".
 *
 * Offers with no value for the chosen key always sink to the BOTTOM, in both
 * directions. Sorting ascending by salary must not fill the top of the screen
 * with offers that simply never mentioned one: absence is not a low score.
 * Ties keep the incoming order, so relevance ranking survives underneath.
 */
export function sortHits(
  hits: readonly MarketHit[],
  sort: MarketSort,
): MarketHit[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...hits].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * factor;
    }
    return String(va).localeCompare(String(vb)) * factor;
  });
}
