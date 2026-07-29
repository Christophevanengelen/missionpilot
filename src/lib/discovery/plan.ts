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
  // `readonly` : cette fonction ne fait que LIRE les affirmations. Le dire dans
  // la signature évite au passage une copie défensive chez chaque appelant.
  claims: readonly { kind: string; state: string; value: unknown }[],
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
  /**
   * La source rend le MÊME tableau quels que soient les mots-clés.
   *
   * Certaines plateformes n'exposent aucun filtre : leur flux est le tableau
   * d'affichage entier, et c'est notre propre gate qui trie ensuite, là où on
   * peut l'expliquer à la personne. Les interroger une fois PAR PLAN revient à
   * télécharger douze fois la même chose et à la reparser douze fois.
   *
   * Ce n'est pas une hypothèse : sur le rendu de production du 2026-07-29 à
   * 17h55, Remote OK a été appelé six fois de suite (six plans concurrents, six
   * défauts de cache simultanés) et les mêmes locataires Recruitee ont été
   * reparsés autant de fois. C'est aussi ce qui transforme une visite en rafale
   * sur des hôtes qui ne nous ont rien demandé.
   */
  ignoresKeywords?: boolean;
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
/**
 * Les plans qu'une source va RÉELLEMENT interroger.
 *
 * Exporté, et c'est délibéré : deux lanceurs traversent ce fan-out — celui-ci
 * et `lancerParSource`, qui rend une promesse par plateforme pour la barre de
 * progression. La règle « une source sans mots-clés ne répond qu'une fois » ne
 * doit pas exister en deux exemplaires, sinon elle sera corrigée d'un côté et
 * oubliée de l'autre. C'est précisément ce qui vient d'arriver : le premier
 * correctif n'avait pas vu le second chemin.
 */
export function plansPourSource<
  Ad extends { sourceUrl: string | null; rawText: string },
>(
  source: DiscoverySource<Ad>,
  plans: readonly SearchPlan[],
): readonly SearchPlan[] {
  return source.ignoresKeywords === true ? plans.slice(0, 1) : plans;
}

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
      (attemptsByName.get(source.name) ?? 0) +
        plansPourSource(source, plans).length,
    );
  }
  // Every (source, plan) pair, enumerated up front in the stable order the
  // results must keep.
  const searches = sources.flatMap((source) =>
    plansPourSource(source, plans).map((plan) => ({ source, plan })),
  );
  const outcomes: ({ ads: Ad[]; sourceName: string } | null)[] = searches.map(
    () => null,
  );
  let failedSearches = 0;

  /**
   * CONCURRENT, where this used to be strictly sequential — and the sequence
   * was the reason everything else was unaffordable.
   *
   * One source answers in about twenty seconds. Multiplied by a dozen search
   * plans, waiting for each before starting the next put the first visit
   * beyond anyone's patience, and it quietly capped what the product could
   * ever do: a second source, or a second country, meant adding minutes.
   * These are independent HTTP calls to different hosts; making them queue
   * bought nothing.
   *
   * The bound is on OUR fan-out, not on any single host — a batch of six is
   * six different endpoints served one request each. What it really protects
   * is the visitor, by making the SLOWEST search the cost of a page instead of
   * the sum of them all.
   */
  const MAX_CONCURRENT_SEARCHES = 6;
  for (let i = 0; i < searches.length; i += MAX_CONCURRENT_SEARCHES) {
    const batch = searches.slice(i, i + MAX_CONCURRENT_SEARCHES);
    await Promise.all(
      batch.map(async ({ source, plan }, offset) => {
        try {
          const ads = await source.search(plan.keywords, plan.mode);
          outcomes[i + offset] = { ads, sourceName: source.name };
        } catch (error) {
          // Recorded, never rethrown: a failing search costs its own results,
          // never the whole run.
          failedSearches += 1;
          failedBySource.set(
            source.name,
            (failedBySource.get(source.name) ?? 0) + 1,
          );
          onSearchError(source.name, plan, error);
        }
      }),
    );
  }

  // Deduplication happens HERE, walking the outcomes in their original order,
  // and deliberately NOT inside the concurrent work. Which of two identical
  // ads survives then depends on the source order the caller chose, not on
  // which HTTP response happened to arrive first — a result list that
  // reshuffles between two identical searches is one nobody can trust.
  for (const outcome of outcomes) {
    if (outcome === null) continue;
    for (const ad of outcome.ads) {
      const key = ad.sourceUrl ?? ad.rawText;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ad, sourceName: outcome.sourceName });
    }
  }
  const totalSearches = searches.length;
  return {
    items,
    failedSearches,
    totalSearches,
    // Map iteration order is insertion order, which follows the stable source
    // order of the outer loop. Le dénominateur vient de `attemptsByName` et de
    // lui seul : une source qui ignore les mots-clés ne tente qu'UNE recherche,
    // et lui compter `plans.length` échecs possibles annoncerait « 1 sur 4 » là
    // où elle n'a essayé qu'une fois.
    failedSources: [...failedBySource].map(([name, failed]) => ({
      name,
      failed,
      total: attemptsByName.get(name) ?? 1,
    })),
  };
}
