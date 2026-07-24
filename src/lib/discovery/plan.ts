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
export async function runSearchPlans<
  Ad extends { sourceUrl: string | null; rawText: string },
>(
  plans: readonly SearchPlan[],
  search: (keywords: string[], mode: SearchPlan["mode"]) => Promise<Ad[]>,
  onSearchError: (plan: SearchPlan, error: unknown) => void,
): Promise<{ ads: Ad[]; failedSearches: number }> {
  const seen = new Set<string>();
  const ads: Ad[] = [];
  let failedSearches = 0;
  for (const plan of plans) {
    try {
      for (const ad of await search(plan.keywords, plan.mode)) {
        const key = ad.sourceUrl ?? ad.rawText;
        if (seen.has(key)) continue;
        seen.add(key);
        ads.push(ad);
      }
    } catch (error) {
      failedSearches += 1;
      onSearchError(plan, error);
    }
  }
  return { ads, failedSearches };
}
