import "server-only";

import { createLogger } from "@/lib/observability/logger";
import type { LinkedInRecords } from "./linkedin-export";
import {
  DOMAINES,
  lirePage,
  MDP_VERSION,
  recommandationsRecues,
  type ClePivot,
} from "./linkedin-mdp-normalise";

/**
 * Import du parcours par l'API Member Snapshot (Member Data Portability).
 *
 * C'est la seule voie qui rapatrie automatiquement un parcours LinkedIn sans
 * société vérifiée : LinkedIn fournit une page entreprise par défaut exprès
 * pour ce produit, et l'accès est accordé sans revue. Sa contrepartie est que
 * le jeton s'obtient à la main dans le portail développeur et n'est valable que
 * pour un membre de l'EEE ou de Suisse — ce n'est donc pas un bouton offert au
 * public, c'est un import que la personne déclenche pour elle-même.
 *
 * DEUX RÈGLES QUI NE SE NÉGOCIENT PAS :
 *
 * **Le jeton n'est jamais conservé.** Il arrive en argument, il sert, il
 * disparaît avec l'appel. Aucune colonne, aucune variable d'environnement,
 * aucun cache. La promesse du produit est « rien n'est gardé sauf le profil » ;
 * ajouter une fonctionnalité qui range un secret en base la briserait à
 * l'endroit exact où elle compte.
 *
 * **Le jeton n'entre jamais dans un journal ni dans un message d'erreur.** Les
 * erreurs HTTP sont donc reformulées à partir du seul code de statut, sans
 * jamais recopier ni l'en-tête d'autorisation ni le corps de la réponse, qui
 * peut refléter la requête.
 */

const BASE = "https://api.linkedin.com/rest/memberSnapshotData";
const TIMEOUT_MS = 30_000;

/**
 * `start` est un NUMÉRO DE PAGE, pas un décalage d'éléments — la documentation
 * est explicite et l'inverse aurait produit un import silencieusement tronqué.
 * Le plafond existe parce que la doc dit de boucler « jusqu'à recevoir une
 * erreur », ce qui, mal implémenté, est une boucle infinie sur un service
 * distant.
 */
const MAX_PAGES = 20;

export class LinkedInMdpError extends Error {}

const log = createLogger({ module: "profile-linkedin-mdp" });

export type RapportDomaine = {
  cle: ClePivot;
  domaine: string;
  lignes: number;
  /** Les libellés réellement renvoyés. Ils ne sont documentés pour aucun
   *  domaine sauf PROFILE : les afficher est la seule façon de savoir si la
   *  lecture a trouvé ce qu'elle croyait lire. */
  champsVus: string[];
  /** Renseigné quand des données existaient mais n'ont délibérément pas été
   *  importées — jamais un échec masqué. */
  ecarte: string | null;
};

function messageDErreur(statut: number): string {
  if (statut === 401 || statut === 403) {
    return "LinkedIn a refusé ce jeton. Il expire au bout de 60 jours : regénérez-en un dans le portail développeur.";
  }
  if (statut === 426) {
    return `LinkedIn a refusé la version d’API. Ce point d’entrée n’accepte que ${MDP_VERSION}.`;
  }
  if (statut === 429) {
    return "LinkedIn limite temporairement les appels. Réessayez dans quelques minutes.";
  }
  return `LinkedIn a répondu ${statut}.`;
}

async function recupererDomaine(
  jeton: string,
  domaine: string,
): Promise<{ lignes: Record<string, string>[]; champsVus: string[] }> {
  const lignes: Record<string, string>[] = [];
  const champsVus = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE}?q=criteria&domain=${encodeURIComponent(domaine)}&start=${page}`;
    const reponse = await fetch(url, {
      headers: {
        // Seule version acceptée ; toute autre échoue en 426.
        "Linkedin-Version": MDP_VERSION,
        Authorization: `Bearer ${jeton}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!reponse.ok) {
      // La doc prescrit de boucler « jusqu'à une erreur » : une erreur APRÈS
      // avoir déjà lu des pages est donc la fin normale des données, pas une
      // panne. Une erreur sur la PREMIÈRE page, elle, est un vrai échec.
      if (page > 0) break;
      // Le corps n'est jamais lu ni recopié : il peut refléter la requête,
      // donc l'en-tête d'autorisation.
      throw new LinkedInMdpError(messageDErreur(reponse.status));
    }

    let charge: unknown;
    try {
      charge = await reponse.json();
    } catch {
      break;
    }

    const lue = lirePage(charge);
    for (const champ of lue.champsVus) champsVus.add(champ);
    if (lue.lignes.length === 0) break;
    lignes.push(...lue.lignes);
  }

  return { lignes, champsVus: [...champsVus] };
}

/**
 * Rapatrie les domaines dont on sait lire quelque chose, et rend compte de ce
 * qui est arrivé. Un domaine qui échoue coûte ses propres lignes, jamais
 * l'import entier : un parcours partiel se complète, un import annulé se
 * recommence de zéro.
 */
export async function recupererParcours(jeton: string): Promise<{
  records: LinkedInRecords;
  rapport: RapportDomaine[];
}> {
  const propre = jeton.trim();
  if (propre === "") {
    throw new LinkedInMdpError("Aucun jeton fourni.");
  }

  const records: LinkedInRecords = {};
  const rapport: RapportDomaine[] = [];
  let premiereErreur: Error | null = null;

  for (const [cle, domaine] of Object.entries(DOMAINES) as [
    ClePivot,
    string,
  ][]) {
    try {
      const { lignes, champsVus } = await recupererDomaine(propre, domaine);
      let retenues = lignes;
      let ecarte: string | null = null;

      if (cle === "recommendationsReceived") {
        const tri = recommandationsRecues(lignes);
        retenues = tri.gardees;
        ecarte = tri.motifSiVide;
      }

      records[cle] = retenues;
      rapport.push({
        cle,
        domaine,
        lignes: retenues.length,
        champsVus,
        ecarte,
      });
    } catch (erreur) {
      // Journalisé SANS le jeton ni l'URL complète — seulement le domaine.
      log.warn("domaine snapshot indisponible", {
        domaine,
        raison: erreur instanceof Error ? erreur.message : "inconnue",
      });
      rapport.push({
        cle,
        domaine,
        lignes: 0,
        champsVus: [],
        ecarte: erreur instanceof Error ? erreur.message : "Domaine illisible.",
      });
      if (premiereErreur === null && erreur instanceof Error) {
        premiereErreur = erreur;
      }
    }
  }

  // Rien du tout : c'est un échec, et il doit le dire. Un import « réussi » qui
  // ne remonte rien est exactement le mode de défaillance que ce module a été
  // écrit pour rendre impossible.
  const total = rapport.reduce((somme, r) => somme + r.lignes, 0);
  if (total === 0) {
    throw new LinkedInMdpError(
      premiereErreur?.message ??
        "LinkedIn n’a renvoyé aucune donnée. Après avoir donné votre consentement, certains domaines mettent un moment à être prêts — réessayez plus tard.",
    );
  }

  return { records, rapport };
}
