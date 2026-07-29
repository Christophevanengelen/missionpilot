import "server-only";

import { plansPourSource, type DiscoverySource, type SearchPlan } from "./plan";

/**
 * Une promesse PAR SOURCE, sans desserrer la borne de fan-out.
 *
 * POURQUOI CE MODULE EXISTE. `runMultiSourceDiscovery` répond d'un bloc : on
 * n'apprend qu'une plateforme a fini qu'au moment où toutes ont fini. L'écran
 * ne pouvait donc rien montrer avant la dernière — et pendant vingt secondes,
 * une page qui cherche et une page en panne se ressemblaient exactement.
 *
 * CE QUI EST PRÉSERVÉ, et qui rendait le découpage moins évident qu'il n'en a
 * l'air :
 *
 * 1. **La borne.** Six recherches simultanées AU TOTAL, pas six par source.
 *    Découper naïvement en une promesse par source multiplierait le fan-out par
 *    le nombre de plateformes — c'est exactement l'erreur qui a fait répondre
 *    HTTP 429 à Recruitee le 2026-07-29.
 * 2. **L'ordre.** Chaque source garde ses résultats dans l'ordre de ses plans,
 *    et l'appelant les concatène dans l'ordre stable des sources. La
 *    déduplication finale reste donc déterministe : deux recherches identiques
 *    rendent la même liste, quel que soit l'ordre d'arrivée des réponses.
 *
 * Ce module ne déduplique pas et ne classe pas. Il découpe, et c'est tout.
 */

/** Le même plafond que le lanceur d'origine, et pour la même raison : ce qu'il
 *  protège n'est pas un hôte en particulier, c'est le visiteur — il fait payer
 *  la recherche LA PLUS LENTE plutôt que la somme de toutes. */
export const MAX_CONCURRENT_SEARCHES = 6;

export type ResultatSource<Ad> = {
  nom: string;
  /** Les annonces, dans l'ordre des plans. Vide si tout a échoué. */
  ads: Ad[];
  /** Combien de recherches ont échoué pour cette source, sur combien tentées.
   *  Les deux nombres comptent : « 0 sur 3 » et « 3 sur 3 » se lisent tout
   *  autrement, et sans dénominateur une source entièrement muette ressemble à
   *  une source qui a simplement perdu une recherche. */
  echecs: number;
  tentatives: number;
};

/**
 * Un jeton de concurrence partagé par TOUTES les sources.
 *
 * C'est la pièce qui permet d'avoir des promesses séparées sans multiplier le
 * fan-out : chaque recherche attend son tour dans la même file, quelle que soit
 * la plateforme qui la demande.
 */
function creerLimiteur(max: number) {
  let enCours = 0;
  const file: (() => void)[] = [];

  const liberer = () => {
    enCours -= 1;
    const suivant = file.shift();
    if (suivant) suivant();
  };

  return async function limiter<T>(travail: () => Promise<T>): Promise<T> {
    if (enCours >= max) {
      await new Promise<void>((resolve) => file.push(resolve));
    }
    enCours += 1;
    try {
      return await travail();
    } finally {
      liberer();
    }
  };
}

/**
 * Lance toutes les recherches et rend UNE PROMESSE PAR SOURCE, dans l'ordre
 * stable des sources reçues.
 *
 * Les promesses sont créées immédiatement — le travail démarre pour tout le
 * monde en même temps, le limiteur se charge de l'étaler. Attendre la première
 * promesse ne retarde donc pas les autres, ce qui est toute la différence entre
 * « afficher au fil de l'eau » et « afficher dans l'ordre où on a demandé ».
 *
 * Une source ne rejette JAMAIS : un échec devient un compteur. Une promesse
 * rejetée ferait tomber la frontière `Suspense` qui l'attend, et une plateforme
 * en panne effacerait l'écran des autres.
 */
export function lancerParSource<
  Ad extends { sourceUrl: string | null; rawText: string },
>(
  plans: readonly SearchPlan[],
  sources: readonly DiscoverySource<Ad>[],
  onSearchError: (sourceName: string, plan: SearchPlan, error: unknown) => void,
): { nom: string; promesse: Promise<ResultatSource<Ad>> }[] {
  const limiter = creerLimiteur(MAX_CONCURRENT_SEARCHES);

  return sources.map((source) => ({
    nom: source.name,
    promesse: (async () => {
      // La MÊME règle que l'autre lanceur, et importée de lui : une source qui
      // n'expose aucun filtre rend le même tableau pour tous les plans, donc on
      // ne le lui demande qu'une fois. Sans cette ligne, la barre de
      // progression réintroduisait à elle seule les téléchargements répétés que
      // le correctif venait de supprimer.
      const plansDeLaSource = plansPourSource(source, plans);
      // `allSettled` sur les plans de CETTE source : l'ordre du tableau suit
      // l'ordre des plans, jamais l'ordre d'arrivée.
      const parPlan = await Promise.all(
        plansDeLaSource.map(async (plan) => {
          try {
            const ads = await limiter(() =>
              source.search(plan.keywords, plan.mode),
            );
            return { ads, echec: false };
          } catch (error) {
            // Enregistré, jamais relancé : une recherche qui échoue coûte ses
            // propres résultats, jamais la source entière ni la page.
            onSearchError(source.name, plan, error);
            return { ads: [] as Ad[], echec: true };
          }
        }),
      );

      return {
        nom: source.name,
        ads: parPlan.flatMap((r) => r.ads),
        echecs: parPlan.filter((r) => r.echec).length,
        // Ce qui a VRAIMENT été tenté, et non le nombre de plans : afficher
        // « 0 sur 4 » à une source interrogée une seule fois donnerait à croire
        // que trois recherches ont abouti là où aucune n'a eu lieu.
        tentatives: plansDeLaSource.length,
      };
    })(),
  }));
}
