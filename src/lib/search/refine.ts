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
   * Drop offers published longer ago than this, in days. `null` = no limit.
   *
   * Defaults to a real value rather than "all": a view of what is open RIGHT
   * NOW has no business leading with a listing from two years ago, and
   * production showed exactly that — 736-day-old ads at the top. An offer with
   * NO stated date is never dropped by this: unknown is not old.
   */
  maxAgeDays: number | null;
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
  maxAgeDays: null,
  includeUnstated: true,
};

/** The age windows offered, plus "no limit". 90 days is the default: it clears
 *  the obviously dead listings without hiding a market whose median age was
 *  measured at 26 days. */
export const AGE_WINDOWS = [7, 30, 90] as const;
export const DEFAULT_MAX_AGE_DAYS = 90;

export const DEFAULT_FILTERS: MarketFilters = {
  ...NO_FILTERS,
  maxAgeDays: DEFAULT_MAX_AGE_DAYS,
};

const DAY_MS = 86_400_000;

/** Whether an offer is recent enough. An UNDATED offer always passes — we do
 *  not know that it is old, and guessing would hide live listings from the
 *  sources that simply never state a date. */
function passesAge(
  postedAt: string | null,
  maxAgeDays: number | null,
  now: number,
): boolean {
  if (maxAgeDays === null) return true;
  if (postedAt === null) return true;
  const ms = Date.parse(postedAt);
  if (!Number.isFinite(ms)) return true;
  return now - ms <= maxAgeDays * DAY_MS;
}

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
  now: number = Date.now(),
): MarketHit[] {
  return hits.filter(
    (h) =>
      passesAge(h.postedAt, filters.maxAgeDays, now) &&
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
/** Rank of a confidence level — "none" (nothing was decidable) sinks. */
const CONFIDENCE_RANK: Record<MarketHit["confidence"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function sortValue(hit: MarketHit, key: SortKey): number | string | null {
  switch (key) {
    case "relevance":
      // Handled by `compareRelevance` — see there. Never reached.
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
/**
 * Relevance, as three ordered questions rather than one blended number.
 *
 * A single weighted metric would have to invent exchange rates between things
 * that are not comparable ("is a phrase match worth 20 points of score?").
 * Asking the questions in order keeps every step explainable, which is the
 * whole point — the user must be able to see WHY an offer leads.
 *
 * 1. Does the searched role actually appear in the title? Sources match words,
 *    so "Service Designer" returns "designers floraux pour le service designer
 *    floral". Both words are there; the job is not.
 * 2. How much of this offer could we judge at all? An offer stating nothing
 *    has its undecidable components dropped from the average, which would
 *    otherwise let silence outrank a real partial match.
 * 3. Only then, the score itself.
 */
function compareRelevance(a: MarketHit, b: MarketHit): number {
  if (a.titlePhraseMatch !== b.titlePhraseMatch)
    return a.titlePhraseMatch ? -1 : 1;
  const ca = CONFIDENCE_RANK[a.confidence];
  const cb = CONFIDENCE_RANK[b.confidence];
  if (ca !== cb) return cb - ca;
  return (b.score ?? -1) - (a.score ?? -1);
}

export function sortHits(
  hits: readonly MarketHit[],
  sort: MarketSort,
): MarketHit[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  if (sort.key === "relevance") {
    return [...hits].sort((a, b) => compareRelevance(a, b) * -factor);
  }
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
