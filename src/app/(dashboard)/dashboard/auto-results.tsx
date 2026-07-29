import { Suspense } from "react";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { loadAnswers } from "@/lib/profile/clarifications";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { buildProfileDossier } from "@/lib/matching/insight-logic";
import {
  planDeRepli,
  type ProfileSearchPlan,
} from "@/lib/search/plan-from-profile";
import { lirePlanPrecalcule } from "@/lib/search/plan-store";
import { demanderRecalculDuPlan } from "@/lib/search/plan-demande";
import { verifySession } from "@/lib/auth/dal";
import { TRIAGE_BATCH, aiTriageOffers } from "@/lib/search/ai-triage";
import { applyTriage } from "@/lib/search/apply-triage";
import { configuredSources } from "@/lib/discovery/sources";
import { assemblerMarche } from "@/lib/search/market";
import {
  lancerParSource,
  type ResultatSource,
} from "@/lib/discovery/par-source";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import type { SearchPlan } from "@/lib/discovery/plan";
import type { ProfilePreferences } from "@/domain/profile";
import type { ProfileSignals } from "@/lib/matching/score";
import { createLogger } from "@/lib/observability/logger";
import type { MarketSearchResult } from "@/lib/search/types";
import { ProgressionSources } from "./progression-sources";
import { SearchPanel } from "./search-panel";

const logger = createLogger({ module: "auto-results" });

type Lancement = {
  nom: string;
  promesse: Promise<ResultatSource<DiscoveredAd>>;
};

/** La collecte pure : attend les plateformes, assemble, trie. Aucun JSX ici,
 *  donc le `try/catch` ne peut rien avaler d'autre que ce qu'il surveille. */
async function rassembler({
  lancements,
  plans,
  preferences,
  signals,
  dossier,
}: {
  lancements: readonly Lancement[];
  plans: readonly SearchPlan[];
  preferences: ProfilePreferences;
  signals: ProfileSignals;
  dossier: string;
}): Promise<{
  initial: MarketSearchResult | null;
  issue: "ok" | "no_plan" | "error";
}> {
  try {
    const resultats = await Promise.all(lancements.map((l) => l.promesse));
    let initial = assemblerMarche(resultats, plans, preferences, signals);

    // Lire les offres et écarter le bruit. Seul le haut du classement est jugé :
    // payer pour lire des offres que personne ne fera défiler dépenserait les
    // crédits du propriétaire pour rien.
    if (initial.hits.length > 0) {
      const head = initial.hits.slice(0, TRIAGE_BATCH);
      const tail = initial.hits.slice(TRIAGE_BATCH);
      const verdicts = await aiTriageOffers(dossier, head);
      initial = { ...initial, hits: [...applyTriage(head, verdicts), ...tail] };
    }
    return { initial, issue: "ok" };
  } catch (error) {
    // Une ouverture ratée ne doit pas vider la page : le panneau se rend quand
    // même et la recherche manuelle reste possible. Dégrader vaut mieux qu'un mur.
    logger.error("auto search errored", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { initial: null, issue: "error" };
  }
}

/**
 * Les résultats, une fois toutes les plateformes revenues.
 *
 * Séparé de `AutoResults` pour une raison précise : ce composant-ci ATTEND,
 * l'autre non. Sa frontière `Suspense` est donc la seule chose que la lenteur
 * retarde — la liste des plateformes, elle, s'affiche immédiatement et se
 * remplit au fil des réponses.
 */
async function ResultatsMarche({
  lancements,
  plans,
  preferences,
  signals,
  dossier,
  query,
  countries,
  plan,
}: {
  lancements: readonly Lancement[];
  plans: readonly SearchPlan[];
  preferences: ProfilePreferences;
  signals: ProfileSignals;
  dossier: string;
  query: string;
  countries: string[];
  plan: ProfileSearchPlan;
}) {
  /* Le `try/catch` est CONFINÉ à la collecte, jamais autour du JSX : englober
     le rendu ferait attraper par ce `catch` les erreurs des composants
     enfants, qui doivent remonter à une frontière d'erreur (règle
     react-hooks/error-boundaries). Une panne de rendu avalée ici deviendrait
     un écran silencieusement faux. */
  const { initial, issue } = await rassembler({
    lancements,
    plans,
    preferences,
    signals,
    dossier,
  });

  return (
    <SearchPanel
      defaultQuery={query}
      defaultCountries={countries}
      initialResult={initial}
      openingOutcome={issue}
      stepUpTitles={plan.stepUpTitles}
      searchedTitles={plan.searchedTitles}
      trajectory={
        plan.trajectory
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

/**
 * The search the user never asked for — because they should not have to.
 *
 * The product is not a search box: it is "you connect, and what the market has
 * for you today is already on screen". The scope was understood once, at
 * onboarding, from the CV and the conditions the user accepts; from then on the
 * engine works unattended and the only gesture left is clicking through to an
 * offer.
 *
 * CE COMPOSANT NE FAIT PLUS ATTENDRE. Il lit le profil, lance les plateformes,
 * et rend immédiatement : la liste des sources en cours d'interrogation, puis
 * une frontière `Suspense` pour les résultats. Auparavant il attendait tout —
 * la page restait vide une vingtaine de secondes, et une recherche en cours
 * ressemblait exactement à une panne.
 *
 * Still nothing is stored. The profile is remembered; the offers are not.
 */
type Preparation =
  | { etat: "erreur" }
  | { etat: "sans-plan"; query: string; plan: ProfileSearchPlan }
  | {
      etat: "pret";
      query: string;
      plan: ProfileSearchPlan;
      lancements: Lancement[];
      preferences: ProfilePreferences;
      signals: ProfileSignals;
      dossier: string;
    };

/** Tout ce qui peut échouer, isolé du rendu. Même raison que `rassembler` :
 *  aucun JSX sous ce `try`. */
async function preparer(countries: string[]): Promise<Preparation> {
  try {
    const session = await verifySession();
    const client = await createClient();
    const profile = await getOwnProfile(client);
    const [living, preferences, clarifications] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
      loadAnswers(client, profile.id),
    ]);

    const profileDossier = buildProfileDossier(
      living.claims,
      preferences,
      clarifications,
    );

    /**
     * LE RENDU N'APPELLE AUCUN MODÈLE POUR PLANIFIER. Cet écran enchaînait
     * trois appels OpenAI avant que la recherche ne commence — 10,1 s puis
     * 22,6 s, mesurés en production le 2026-07-29. On lit désormais le plan
     * rangé en base ; à défaut, repli déterministe immédiat et calcul demandé
     * en fond pour la visite suivante.
     */
    let plan = await lirePlanPrecalcule(client, profile.id, profileDossier);
    if (!plan) {
      plan = planDeRepli(preferences.targetRoleFamilies, living.claims);
      // Demandé, jamais attendu.
      void demanderRecalculDuPlan(session.userId, profile.id);
    }

    const query = preferences.targetRoleFamilies[0] ?? "";
    const sources = configuredSources(countries);

    if (plan.plans.length === 0 || sources.length === 0) {
      return { etat: "sans-plan", query, plan };
    }

    // Lancé ICI, sans `await` : le travail démarre pour toutes les plateformes
    // pendant que le reste de l'arbre se rend.
    const lancements = lancerParSource<DiscoveredAd>(
      plan.plans,
      sources,
      (sourceName, p, error) => {
        logger.error("auto search failed", {
          source: sourceName,
          mode: p.mode,
          reason: error instanceof Error ? error.message : "unknown",
        });
      },
    );

    return {
      etat: "pret",
      query,
      plan,
      lancements,
      preferences,
      signals: profileSignalsFromClaims(living.claims),
      dossier: profileDossier,
    };
  } catch (error) {
    logger.error("auto search errored", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { etat: "erreur" };
  }
}

export async function AutoResults({ countries }: { countries: string[] }) {
  const p = await preparer(countries);

  if (p.etat === "erreur") {
    return (
      <SearchPanel
        defaultQuery=""
        defaultCountries={countries}
        initialResult={null}
        openingOutcome="error"
        stepUpTitles={[]}
        searchedTitles={[]}
        trajectory={null}
      />
    );
  }

  if (p.etat === "sans-plan") {
    return (
      <SearchPanel
        defaultQuery={p.query}
        defaultCountries={countries}
        initialResult={null}
        openingOutcome="no_plan"
        stepUpTitles={p.plan.stepUpTitles}
        searchedTitles={p.plan.searchedTitles}
        trajectory={null}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Rendue TOUT DE SUITE : c'est elle qui remplace la page vide. */}
      <ProgressionSources lancements={p.lancements} />
      <Suspense fallback={null}>
        <ResultatsMarche
          lancements={p.lancements}
          plans={p.plan.plans}
          preferences={p.preferences}
          signals={p.signals}
          dossier={p.dossier}
          query={p.query}
          countries={countries}
          plan={p.plan}
        />
      </Suspense>
    </div>
  );
}
