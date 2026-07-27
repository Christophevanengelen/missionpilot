import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * Le consentement au traitement des données sensibles d'un CV (art. 9(2)(a)).
 *
 * Trois règles portent tout ce module :
 *
 * 1. `null` veut dire « jamais donné », JAMAIS « refusé ». La distinction
 *    compte le jour où quelqu'un demande quand il a consenti — et l'art. 7(1)
 *    exige de pouvoir le démontrer, ce qu'un booléen ne permet pas.
 *
 * 2. Le consentement est demandé AVANT le dépôt, pas après l'analyse. Cocher
 *    une case sur un écran de résultats reviendrait à faire consentir quelqu'un
 *    à un traitement déjà effectué.
 *
 * 3. Le retrait est un droit (art. 7(3)) et doit être aussi simple à exercer
 *    qu'à donner. Il ne demande donc aucune justification et n'ouvre aucune
 *    conversation.
 */
type Client = SupabaseClient<Database>;

export async function lireConsentementArt9(
  client: Client,
  profileId: string,
): Promise<Date | null> {
  const { data, error } = await client
    .from("candidate_profiles")
    .select("art9_consent_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data?.art9_consent_at) return null;
  return new Date(data.art9_consent_at);
}

/**
 * Enregistre le consentement, ou le retire.
 *
 * Un consentement déjà donné n'est PAS réécrit : sa date est celle du moment où
 * la personne a dit oui, et la réécrire à chaque dépôt de CV effacerait
 * précisément ce que l'art. 7(1) demande de conserver.
 */
export async function ecrireConsentementArt9(
  client: Client,
  profileId: string,
  donne: boolean,
): Promise<void> {
  if (donne) {
    const existant = await lireConsentementArt9(client, profileId);
    if (existant) return;
  }
  const { error } = await client
    .from("candidate_profiles")
    .update({ art9_consent_at: donne ? new Date().toISOString() : null })
    .eq("id", profileId);
  if (error) {
    throw new Error(`consent write failed: ${error.code ?? "unknown"}`);
  }
}
