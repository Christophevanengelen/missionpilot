/**
 * The countries a search can target.
 *
 * Until now the deployment carried ONE country in `ADZUNA_COUNTRY`, so a
 * Belgian owner could not search Belgium at all — the single local source was
 * pinned to France. Country is a first-class search dimension, not a
 * deployment setting.
 *
 * Codes are Adzuna's country segments (the only source that partitions its
 * index by country). Sources with no country notion — Himalayas, Jobicy — are
 * unaffected: they answer once, and their own geographic restrictions are what
 * the result filter reads.
 */

export const SEARCH_COUNTRIES = [
  { code: "be", label: "Belgique" },
  { code: "fr", label: "France" },
  { code: "nl", label: "Pays-Bas" },
  { code: "de", label: "Allemagne" },
  { code: "ch", label: "Suisse" },
  { code: "gb", label: "Royaume-Uni" },
  { code: "es", label: "Espagne" },
  { code: "it", label: "Italie" },
] as const;

export type CountryCode = (typeof SEARCH_COUNTRIES)[number]["code"];

const CODES: readonly string[] = SEARCH_COUNTRIES.map((c) => c.code);

export function isCountryCode(value: string): value is CountryCode {
  return CODES.includes(value);
}

/**
 * How many countries one search may target at once.
 *
 * Each country is a SEPARATE call to the country-partitioned source, and one
 * run already issues one call per target métier — so the cost is countries ×
 * métiers. Adzuna allows 25 calls a minute and 250 a day; three countries
 * against three métiers is nine, which stays comfortably inside that while
 * covering the realistic case (home country plus one or two neighbours).
 */
export const MAX_COUNTRIES_PER_SEARCH = 3;

export function labelOf(code: string): string {
  return SEARCH_COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
