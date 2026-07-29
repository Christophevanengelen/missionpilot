"use server";

import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { definirAbonnement, lireAbonnement } from "@/lib/digest/abonnement";

/**
 * Poser ou retirer le récapitulatif hebdomadaire, depuis l'écran du compte.
 *
 * Passe par le client de SESSION, jamais par la clé secrète : la RLS vérifie
 * alors elle-même que la ligne touchée appartient bien à la personne
 * connectée. Utiliser la clé d'administration ici obligerait à réécrire ce
 * contrôle à la main, et à ne jamais l'oublier.
 */
export async function definirDigestAction(
  optedIn: boolean,
): Promise<{ ok: boolean }> {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  return await definirAbonnement(client, profile.id, optedIn);
}

/** L'état courant, pour l'affichage. `null` = jamais touché, ce qui n'est pas
 *  « refusé » : l'écran doit pouvoir proposer sans présumer d'un refus. */
export async function lireDigestAction(): Promise<boolean | null> {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const abonnement = await lireAbonnement(client, profile.id);
  return abonnement === null ? null : abonnement.optedIn;
}
