"use server";

import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { createLogger } from "@/lib/observability/logger";
import { estMotif, MOTIFS, type Comptes, type Motif } from "./motifs";

const log = createLogger({ module: "ecartement" });

/**
 * « Pas pour moi » — ce qui part au serveur quand quelqu'un écarte une offre.
 *
 * REGARDEZ CE QUE CETTE FONCTION NE REÇOIT PAS : ni titre, ni entreprise, ni
 * URL, ni identifiant d'annonce. Un motif, rien d'autre. Le produit promet de
 * ne stocker aucune offre, et un journal des annonces refusées serait ce
 * dossier-là, en négatif — savoir qu'une personne a écarté un poste chez un
 * concurrent en dit autant que de savoir qu'elle l'a ouvert.
 *
 * La signature est donc la garantie : on ne peut pas enregistrer ce qu'on ne
 * reçoit pas. Le test de `motifs.ts` la vérifie, pour qu'un futur « et si on
 * passait aussi l'URL, juste pour déboguer » casse quelque chose de visible.
 *
 * Client de SESSION, jamais la clé secrète : la RLS vérifie elle-même que le
 * compteur touché pend au profil de la personne connectée. La fonction SQL est
 * `security invoker` pour la même raison — un `security definer` aurait
 * contourné toute la garde.
 */
export async function ecarterOffreAction(
  motif: string,
): Promise<{ ok: boolean }> {
  await verifySession();
  // Revérifié côté serveur : la liste fermée du client n'est qu'une commodité
  // d'affichage. La contrainte SQL le revérifie encore — trois fois, parce que
  // c'est le seul endroit où une valeur libre atteindrait la base.
  if (!estMotif(motif)) {
    log.warn("motif d'écartement inconnu");
    return { ok: false };
  }

  const client = await createClient();
  const profile = await getOwnProfile(client);
  const { error } = await client.rpc("ecarter_offre", {
    p_profile_id: profile.id,
    p_reason: motif,
  });
  if (error) {
    log.error("écartement non enregistré");
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Les compteurs de la personne connectée.
 *
 * Rendus en objet plutôt qu'en lignes : l'appelant veut « combien de fois
 * trop junior », pas un tableau à parcourir. Les motifs absents valent zéro et
 * ne sont pas écrits — un zéro explicite et une absence se lisent pareil ici.
 */
export async function lireEcartements(): Promise<Comptes> {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const { data, error } = await client
    .from("offer_dismissals")
    .select("reason, count")
    .eq("profile_id", profile.id);
  if (error || !data) {
    log.error("compteurs d'écartement illisibles");
    return {};
  }
  const comptes: Comptes = {};
  for (const ligne of data) {
    if (estMotif(ligne.reason)) {
      comptes[ligne.reason as Motif] = ligne.count;
    }
  }
  return comptes;
}

/** Le vocabulaire, exposé au client pour construire les boutons sans le
 *  dupliquer. */
export async function motifsDisponibles(): Promise<readonly string[]> {
  return MOTIFS;
}
