import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { buildSearchPlans } from "@/lib/discovery/plan";
import { configuredSources } from "@/lib/discovery/sources";
import { searchMarket } from "@/lib/search/market";
import { createLogger } from "@/lib/observability/logger";
import type { MarketSearchResult } from "@/lib/search/types";
import { SearchPanel } from "./search-panel";

const logger = createLogger({ module: "auto-results" });

/**
 * The search the user never asked for — because they should not have to.
 *
 * The product is not a search box: it is "you connect, and what the market has
 * for you today is already on screen". The scope was understood once, at
 * onboarding, from the CV and the conditions the user accepts; from then on the
 * engine works unattended and the only gesture left is clicking through to an
 * offer.
 *
 * This is an async Server Component behind a Suspense boundary, so the page
 * shell paints immediately and the results arrive when the sources answer —
 * rather than the whole page waiting several seconds on a network fan-out.
 *
 * Still nothing is stored. The profile is remembered; the offers are not.
 */
export async function AutoResults({ countries }: { countries: string[] }) {
  let initial: MarketSearchResult | null = null;
  let query = "";
  try {
    const client = await createClient();
    const profile = await getOwnProfile(client);
    const [living, preferences] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
    ]);
    const plans = buildSearchPlans(
      living.claims,
      preferences.targetRoleFamilies,
    );
    query = preferences.targetRoleFamilies[0] ?? "";
    const sources = configuredSources(countries);
    if (plans.length > 0 && sources.length > 0) {
      initial = await searchMarket(
        plans,
        sources,
        preferences,
        profileSignalsFromClaims(living.claims),
        (sourceName, plan, error) => {
          logger.error("auto search failed", {
            source: sourceName,
            mode: plan.mode,
            reason: error instanceof Error ? error.message : "unknown",
          });
        },
      );
    }
  } catch (error) {
    // A failed opening search must not blank the page: the panel still renders
    // and the user can search by hand. Degrading beats a wall.
    logger.error("auto search errored", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
  }

  return (
    <SearchPanel
      defaultQuery={query}
      defaultCountries={countries}
      initialResult={initial}
    />
  );
}
