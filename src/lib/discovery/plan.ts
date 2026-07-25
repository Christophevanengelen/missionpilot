/**
 * Pure search-plan derivation for auto-discovery (no "use server" here so the
 * sync function is exportable and unit-testable; the action stays a thin
 * orchestrator).
 *
 * Preference order (owner mandate — fluid, métier-driven discovery):
 * 1. `preferences.targetRoleFamilies` — the métiers the validated CV analysis
 *    chose: ONE search per métier (max 3), TITLE-targeted so "Data Engineer"
 *    is the job being offered, not two stray words in a paragraph.
 * 2. Fallback (no target métiers yet): the historical single OR-search over
 *    the confirmed role + skills, matched anywhere in the ad.
 */

export type SearchPlan = {
  keywords: string[];
  mode: "any" | "title";
};

export const MAX_TARGET_SEARCHES = 3;
const MAX_FALLBACK_KEYWORDS = 4;

export function buildSearchPlans(
  claims: { kind: string; state: string; value: unknown }[],
  targetRoleFamilies: readonly string[],
): SearchPlan[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const raw of targetRoleFamilies) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    targets.push(name);
    if (targets.length === MAX_TARGET_SEARCHES) break;
  }
  if (targets.length > 0) {
    return targets.map((t) => ({ keywords: [t], mode: "title" as const }));
  }

  const confirmed = claims.filter((c) => c.state === "confirmed");
  const role = confirmed
    .filter((c) => c.kind === "role")
    .map((c) => (c.value as { title?: unknown })?.title)
    .find((v): v is string => typeof v === "string" && v.trim() !== "");
  const skills = confirmed
    .filter((c) => c.kind === "skill")
    .map((c) => (c.value as { name?: unknown })?.name)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
  const keywords = [...(role ? [role] : []), ...skills].slice(
    0,
    MAX_FALLBACK_KEYWORDS,
  );
  return keywords.length > 0 ? [{ keywords, mode: "any" }] : [];
}

/**
 * Run the plans with per-search isolation: one métier's search failing must
 * not void the others, and the failure COUNT is returned so callers can
 * surface a possibly-incomplete result honestly (never silently). Ads are
 * deduped across searches by provenance URL (fallback: verbatim text) so an
 * ad matching two target métiers is counted once.
 */
/** A legal discovery source (Adzuna, France Travail, …) behind a common
 *  search interface. `search` throws on failure; the runner isolates it. */
export type DiscoverySource<
  Ad extends { sourceUrl: string | null; rawText: string },
> = {
  name: string;
  search: (keywords: string[], mode: SearchPlan["mode"]) => Promise<Ad[]>;
};

/**
 * Run the plans against EVERY configured source with per-search isolation:
 * one (source, plan) search failing must not void the others. Ads are deduped
 * ACROSS sources and plans by provenance URL (fallback: verbatim text), so the
 * same offer surfacing from two sources — or two métiers — is counted once,
 * and each kept ad carries the name of the source it came from (for honest
 * provenance on import). `failedSearches`/`totalSearches` let the caller tell
 * a partial failure from a complete run, and `failedSources` says WHICH source
 * came up short: with several sources configured, "3 searches failed" leaves
 * the owner unable to tell a broken credential from a source-side outage.
 */
export async function runMultiSourceDiscovery<
  Ad extends { sourceUrl: string | null; rawText: string },
>(
  plans: readonly SearchPlan[],
  sources: readonly DiscoverySource<Ad>[],
  onSearchError: (sourceName: string, plan: SearchPlan, error: unknown) => void,
): Promise<{
  items: { ad: Ad; sourceName: string }[];
  failedSearches: number;
  totalSearches: number;
  /** Per-source failure counts, in the stable source order, listing ONLY the
   *  sources that actually failed at least one search. `total` is the
   *  DENOMINATOR — without it, a source that answered nothing at all reads
   *  exactly like one that merely lost a search, and the run looks complete
   *  when a whole source is missing from it. */
  failedSources: { name: string; failed: number; total: number }[];
}> {
  const seen = new Set<string>();
  const items: { ad: Ad; sourceName: string }[] = [];
  const failedBySource = new Map<string, number>();
  // A source NAME can appear several times — Adzuna partitions its index by
  // country, so "Adzuna" is one entry per country searched. The denominator
  // must count those entries, else "3 échecs sur 3" is reported for a source
  // that actually attempted nine searches.
  const attemptsByName = new Map<string, number>();
  for (const source of sources) {
    attemptsByName.set(
      source.name,
      (attemptsByName.get(source.name) ?? 0) + plans.length,
    );
  }
  let failedSearches = 0;
  let totalSearches = 0;
  for (const source of sources) {
    for (const plan of plans) {
      totalSearches += 1;
      try {
        for (const ad of await source.search(plan.keywords, plan.mode)) {
          const key = ad.sourceUrl ?? ad.rawText;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ ad, sourceName: source.name });
        }
      } catch (error) {
        failedSearches += 1;
        failedBySource.set(
          source.name,
          (failedBySource.get(source.name) ?? 0) + 1,
        );
        onSearchError(source.name, plan, error);
      }
    }
  }
  return {
    items,
    failedSearches,
    totalSearches,
    // Map iteration order is insertion order, which follows the stable source
    // order of the outer loop. Every source runs the same plan list, so
    // `plans.length` is each one's denominator.
    failedSources: [...failedBySource].map(([name, failed]) => ({
      name,
      failed,
      total: attemptsByName.get(name) ?? plans.length,
    })),
  };
}
