import "server-only";

import { env } from "@/lib/env";

/**
 * « Remplir avec LinkedIn » — le flux OAuth, côté serveur.
 *
 * Ce que ce module remplace : un champ où l'utilisateur devait coller un jeton
 * généré à la main dans le portail développeur de LinkedIn. C'était un outil de
 * développeur déguisé en fonctionnalité produit. Personne n'ouvre un portail
 * d'API pour déposer son CV, et le proposer sur le premier écran revenait à
 * demander à quelqu'un de faire notre travail.
 *
 * LE JETON N'EST TOUJOURS PAS CONSERVÉ, et c'est ce qui fait tenir la promesse
 * du produit dans le cas le plus tentant de l'y déroger : le code d'autorisation
 * est échangé contre un jeton dans le gestionnaire de retour, le jeton sert
 * immédiatement à lire le parcours, et il meurt avec la requête. Aucune colonne,
 * aucun cookie, aucun cache. Un rafraîchissement automatique aurait exigé de le
 * garder — on préfère redemander à la personne.
 *
 * Le SECRET client ne quitte jamais le serveur : il n'apparaît que dans le corps
 * de l'échange, jamais dans une URL, jamais dans un journal.
 */

const AUTORISATION = "https://www.linkedin.com/oauth/v2/authorization";
const JETON = "https://www.linkedin.com/oauth/v2/accessToken";

/** Member Data Portability (3rd Party) : le seul scope qui rende un parcours
 *  professionnel à une application tierce. Voir docs/linkedin-import.md. */
export const SCOPE = "r_dma_portability_3rd_party";

/** Le témoin anti-CSRF. `state` revient de LinkedIn et doit correspondre à ce
 *  que NOUS avons émis : sans cette comparaison, n'importe qui pourrait faire
 *  atterrir un code d'autorisation étranger dans la session de quelqu'un. */
export const COOKIE_ETAT = "mp_li_state";

export const TIMEOUT_MS = 20_000;

export class LinkedInOAuthError extends Error {}

export function linkedInConfigure(): boolean {
  return (
    env.LINKEDIN_ENABLED === true &&
    typeof env.LINKEDIN_CLIENT_ID === "string" &&
    typeof env.LINKEDIN_CLIENT_SECRET === "string"
  );
}

/** L'adresse de retour, dérivée de l'URL publique de l'application — elle doit
 *  être déclarée à l'identique dans les réglages de l'app LinkedIn. */
export function adresseRetour(): string {
  return new URL("/api/linkedin/callback", env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * L'URL vers laquelle on envoie la personne. Pure et testable : c'est elle qui
 * porte le scope et l'état, deux choses qu'une erreur silencieuse rendrait soit
 * inutiles, soit dangereuses.
 */
export function urlAutorisation(params: {
  clientId: string;
  redirectUri: string;
  etat: string;
}): string {
  const u = new URL(AUTORISATION);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.etat);
  u.searchParams.set("scope", SCOPE);
  return u.toString();
}

/**
 * Échange le code contre un jeton. Le résultat n'est jamais renvoyé au client
 * ni journalisé — il repart directement dans la lecture du parcours.
 */
export async function echangerCode(code: string): Promise<string> {
  if (!linkedInConfigure()) {
    throw new LinkedInOAuthError("linkedin oauth is not configured");
  }
  const corps = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.LINKEDIN_CLIENT_ID as string,
    client_secret: env.LINKEDIN_CLIENT_SECRET as string,
    redirect_uri: adresseRetour(),
  });

  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corps,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!reponse.ok) {
    // Le corps n'est ni lu ni recopié : il peut refléter la requête, donc le
    // secret client.
    throw new LinkedInOAuthError(
      `linkedin: échange du code refusé (HTTP ${reponse.status})`,
    );
  }

  const charge: unknown = await reponse.json().catch(() => null);
  const jeton =
    charge && typeof charge === "object" && "access_token" in charge
      ? (charge as { access_token?: unknown }).access_token
      : null;
  if (typeof jeton !== "string" || jeton.trim() === "") {
    throw new LinkedInOAuthError("linkedin: réponse sans jeton exploitable");
  }
  return jeton;
}
