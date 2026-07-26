import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { loadAnswers } from "@/lib/profile/clarifications";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { buildProfileDossier } from "@/lib/matching/insight-logic";
import { planFromProfile } from "@/lib/search/plan-from-profile";
import { TRIAGE_BATCH, aiTriageOffers } from "@/lib/search/ai-triage";
import { applyTriage } from "@/lib/search/apply-triage";
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
  let plan: Awaited<ReturnType<typeof planFromProfile>> | null = null;
  try {
    const client = await createClient();
    const profile = await getOwnProfile(client);
    const [living, preferences, clarifications] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
      loadAnswers(client, profile.id),
    ]);
    // The market's words for this profile — and, when the career analysis says
    // the step is earned, the words of the level above it too.
    //
    // The clarifications belong here, not merely in the profile screen: the
    // career reading returns `unknown` because a CV lists titles without
    // scope, so an answer that never reaches THIS dossier leaves the next
    // reading as blind as the last, and the staircase never opens.
    const profileDossier = buildProfileDossier(
      living.claims,
      preferences,
      clarifications,
    );
    plan = await planFromProfile(
      profileDossier,
      preferences.targetRoleFamilies,
    );
    const plans = plan.plans;
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
    // Read the offers and drop the noise. Until now the engine compared job
    // TITLES and nothing else — the demand side of an offer was never
    // extracted — which is why a "Service Designer" search could return a
    // florist. Only the top of the ranking is judged: paying to read offers
    // nobody will scroll to would be spending the owner's credits on nothing.
    if (initial && initial.hits.length > 0) {
      const head = initial.hits.slice(0, TRIAGE_BATCH);
      const tail = initial.hits.slice(TRIAGE_BATCH);
      const verdicts = await aiTriageOffers(profileDossier, head);
      initial = { ...initial, hits: [...applyTriage(head, verdicts), ...tail] };
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
      stepUpTitles={plan?.stepUpTitles ?? []}
      trajectory={
        plan?.trajectory
          ? {
              currentLevel: plan.trajectory.currentLevel,
              nextLevel: plan.trajectory.nextLevel,
              readiness: plan.trajectory.readiness,
              evidence: plan.trajectory.evidence,
              missing: plan.trajectory.missing,
              questions: plan.trajectory.questions,
              rationale: plan.trajectory.rationale,
            }
          : null
      }
    />
  );
}
