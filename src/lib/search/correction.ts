import { SEUIL_DIAGNOSTIC, type Comptes } from "@/lib/ecartement/motifs";

/**
 * Ce que les écartements corrigent dans le plan de recherche.
 *
 * C'EST ICI QUE LE « PAS POUR MOI » CESSE D'ÊTRE UN SONDAGE. Sans ce module,
 * les motifs ne serviraient qu'au tableau de pilotage — utile au propriétaire,
 * inutile à la personne qui a cliqué. Un retour qui ne change rien pour celui
 * qui le donne est une case décorative, et ce produit s'interdit les paliers
 * décoratifs.
 *
 * LA RÉPARTITION DES RÔLES EST DÉLIBÉRÉE, et c'est la décision principale du
 * fichier : ce qui relève de l'arithmétique est fait en arithmétique, ce qui
 * relève de la langue est confié au modèle.
 *
 * - « trop junior » trois fois veut dire : vise plus haut. C'est une
 *   comparaison de compteurs. Demander à un modèle de la trancher coûterait un
 *   appel, une latence et une incertitude pour un `>=`.
 * - « pas le bon métier » trois fois veut dire : les MOTS sont faux. Trouver
 *   d'autres façons dont le marché nomme un même parcours est exactement une
 *   tâche de langue, et c'est là qu'un modèle vaut son prix.
 *
 * ON SAIT QUELS MOTS ONT ÉCHOUÉ SANS AVOIR STOCKÉ UNE SEULE OFFRE. Le plan
 * précédent porte ses `searchedTitles` : ce sont les intitulés réellement
 * cherchés. Croisés avec « pas le bon métier », ils disent « ces mots-là n'ont
 * pas marché » — sans qu'aucune annonce n'ait été conservée. C'est ce qui rend
 * cette boucle possible sous la promesse « aucune offre stockée ».
 */

export type Correction = {
  /** Viser la marche d'après même si la lecture de trajectoire hésitait. */
  viserPlusHaut: boolean;
  /** Renoncer à la marche d'après : elle produit des refus. */
  viserPlusBas: boolean;
  /** Les intitulés déjà cherchés qui ont produit des « pas le bon métier ».
   *  Vides quand rien ne le justifie — on ne prive pas le modèle de mots sur
   *  la foi d'un clic. */
  intitulesEnEchec: string[];
};

export const AUCUNE_CORRECTION: Correction = {
  viserPlusHaut: false,
  viserPlusBas: false,
  intitulesEnEchec: [],
};

/**
 * Un plafond sur ce qu'on transmet au modèle.
 *
 * Une liste d'intitulés à éviter qui grandit sans fin finirait par occuper
 * plus de place que le dossier lui-même, et par décrire un profil « en creux »
 * plutôt qu'en positif. Six suffit à faire comprendre la direction.
 */
const MAX_INTITULES_EN_ECHEC = 6;

export function correctionDepuisEcartements(
  comptes: Comptes,
  intitulesPrecedents: readonly string[] = [],
): Correction {
  const junior = comptes.too_junior ?? 0;
  const senior = comptes.too_senior ?? 0;
  const metier = comptes.wrong_role ?? 0;

  // Les deux sens s'annulent quand ils sont à égalité, et c'est voulu : « trois
  // fois trop junior ET trois fois trop senior » ne dit pas où viser, ça dit
  // que le niveau n'est pas le problème. Bouger quand même serait suivre du
  // bruit.
  const viserPlusHaut = junior >= SEUIL_DIAGNOSTIC && junior > senior;
  const viserPlusBas = senior >= SEUIL_DIAGNOSTIC && senior > junior;

  return {
    viserPlusHaut,
    viserPlusBas,
    intitulesEnEchec:
      metier >= SEUIL_DIAGNOSTIC
        ? [
            ...new Set(
              intitulesPrecedents
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            ),
          ].slice(0, MAX_INTITULES_EN_ECHEC)
        : [],
  };
}

/**
 * La signature des écartements, à replier dans l'empreinte du plan.
 *
 * SANS ELLE, LA CORRECTION N'ARRIVERAIT JAMAIS. Le plan précalculé n'est
 * recalculé que lorsque l'empreinte du dossier change ; or écarter une offre
 * ne touche pas au dossier. Le plan resterait donc éternellement celui d'avant
 * le retour — la personne cliquerait, et rien ne bougerait. La mécanique
 * d'invalidation existante fait le travail dès qu'on lui donne à voir ce
 * chiffre-là.
 *
 * Ordonnée, pour qu'un même état produise toujours la même chaîne : une
 * signature instable ferait recalculer un plan identique à chaque visite.
 */
export function signatureEcartements(comptes: Comptes): string {
  const parties = Object.entries(comptes)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([motif, n]) => `${motif}:${n}`);
  return parties.length === 0 ? "" : `ecartements(${parties.join(",")})`;
}
