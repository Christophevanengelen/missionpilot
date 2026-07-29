import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * L'abonnement au digest : le lire, le poser, le retirer.
 *
 * Rien ici n'envoie quoi que ce soit. La séparation est délibérée — un module
 * qui saurait à la fois qui est abonné ET comment écrire serait l'endroit où
 * l'on finit par envoyer sans vérifier.
 */

type Client = SupabaseClient<Database>;

/**
 * 32 octets tirés au hasard, en hexadécimal — 64 caractères, ce que la
 * contrainte de la table impose.
 *
 * `randomBytes` et non `Math.random` : le jeton désabonne SANS authentifier,
 * donc un générateur prévisible permettrait de désabonner autrui en devinant.
 * C'est la seule propriété de sécurité de ce jeton, et elle tient entièrement
 * à cette ligne.
 */
export function creerJeton(): string {
  return randomBytes(32).toString("hex");
}

export type Abonnement = {
  optedIn: boolean;
  unsubscribeToken: string;
  lastSentAt: string | null;
};

/** `null` quand la personne n'a jamais touché au réglage — ce qui n'est PAS la
 *  même chose que « désabonnée », et l'écran doit pouvoir faire la différence
 *  pour proposer sans présumer. */
export async function lireAbonnement(
  client: Client,
  profileId: string,
): Promise<Abonnement | null> {
  const { data, error } = await client
    .from("digest_subscriptions")
    .select("opted_in, unsubscribe_token, last_sent_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    optedIn: data.opted_in,
    unsubscribeToken: data.unsubscribe_token,
    lastSentAt: data.last_sent_at,
  };
}

/**
 * Pose le choix de la personne.
 *
 * Le jeton n'est créé qu'à la PREMIÈRE écriture et n'est jamais renouvelé
 * ensuite : le faire tourner casserait les liens des e-mails déjà envoyés, et
 * quelqu'un qui clique « se désabonner » dans un message de la semaine
 * dernière tomberait sur une erreur au moment précis où il veut partir. La
 * sortie doit toujours marcher.
 */
export async function definirAbonnement(
  client: Client,
  profileId: string,
  optedIn: boolean,
): Promise<{ ok: boolean }> {
  const existant = await lireAbonnement(client, profileId);
  const { error } = await client.from("digest_subscriptions").upsert(
    {
      profile_id: profileId,
      opted_in: optedIn,
      unsubscribe_token: existant?.unsubscribeToken ?? creerJeton(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  return { ok: !error };
}

/**
 * Désabonne à partir du jeton seul, sans session.
 *
 * Écrit avec la clé secrète : celui qui clique depuis sa boîte aux lettres
 * n'est pas connecté, et lui demander de l'être pour partir serait une porte
 * fermée à clé de l'intérieur. Le contrôle compensatoire est que le jeton est
 * imprévisible et qu'il ne donne accès à RIEN d'autre — au pire, un jeton volé
 * désabonne sa victime.
 *
 * Rend `true` même si la ligne était déjà désabonnée : deux clics sur le même
 * lien doivent donner la même page rassurante, jamais une erreur.
 */
export async function desabonnerParJeton(
  admin: Client,
  token: string,
): Promise<{ trouve: boolean }> {
  // Longueur vérifiée AVANT la requête : une valeur hors format n'a aucune
  // raison d'atteindre la base, et l'écarter tôt évite d'offrir un oracle de
  // temps sur ce qui existe ou non.
  if (!/^[0-9a-f]{64}$/.test(token)) return { trouve: false };

  const { data, error } = await admin
    .from("digest_subscriptions")
    .update({ opted_in: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("profile_id");

  if (error) return { trouve: false };
  return { trouve: (data?.length ?? 0) > 0 };
}
