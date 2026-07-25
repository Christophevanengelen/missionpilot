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
import { comparablePay } from "./compensation";
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

/**
 * How many results each option would leave — including an explicit count for
 * "the source did not say".
 *
 * A benchmark of ten job boards (Google for Jobs, LinkedIn, Indeed, Otta,
 * Wellfound, Free-Work…) found NONE of them shows facet counts, though it is
 * standard in e-commerce search. It is the cheapest possible fix here, since
 * the whole result set is already in memory, and it is what makes a three-state
 * filter legible: without a count, the user cannot tell what checking a box
 * will cost them. It also surfaces a truth the category hides — that most
 * listings say nothing about remote or contract type.
 *
 * Counted the standard faceted way: over the hits passing the OTHER criteria,
 * so a count always predicts what clicking will actually show.
 */
export type Facet<T> = { value: T | null; count: number };

function facetsFor<T extends string>(
  hits: readonly MarketHit[],
  filters: MarketFilters,
  field: "engagementType" | "remoteType",
  values: readonly T[],
): Facet<T>[] {
  // Neutralise this dimension so its own selection does not shrink its counts.
  const others = filterHits(hits, {
    ...filters,
    ...(field === "engagementType"
      ? { engagementTypes: [] }
      : { remoteTypes: [] }),
  });
  const counted = values.map((value) => ({
    value,
    count: others.filter((h) => h[field] === value).length,
  }));
  return [
    ...counted,
    // "Not stated" is a first-class, countable value — never a silent residue.
    { value: null, count: others.filter((h) => h[field] === null).length },
  ];
}

export function engagementFacets(
  hits: readonly MarketHit[],
  filters: MarketFilters,
  values: readonly EngagementType[],
): Facet<EngagementType>[] {
  return facetsFor(hits, filters, "engagementType", values);
}

export function remoteFacets(
  hits: readonly MarketHit[],
  filters: MarketFilters,
  values: readonly RemoteType[],
): Facet<RemoteType>[] {
  return facetsFor(hits, filters, "remoteType", values);
}

export const SORT_KEYS = [
  "relevance",
  "freshness",
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
    case "freshness":
      // Milliseconds since epoch, so "descending" means newest first — the
      // direction a job seeker almost always wants.
      return hit.postedAt === null ? null : Date.parse(hit.postedAt);
    case "compensation":
      // Annualised first: comparing a raw 90 000 €/an against a raw 900 €/jour
      // ranks them backwards, because the day rate is worth nearly twice as
      // much over a year. See `compensation.ts` for the disclosed assumption.
      return comparablePay(hit);
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
