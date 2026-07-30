import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { env } from "@/lib/env";

/**
 * Le retour du lien magique.
 *
 * CETTE ROUTE DOIT ÊTRE PUBLIQUE, et c'est le piège de tout le mécanisme : au
 * moment où la personne clique sur son lien, aucune session n'existe encore.
 * Si le proxy la protège comme les autres, il la renvoie vers la connexion
 * AVANT que `verifyOtp` ait pu créer la session — la personne clique, retombe
 * sur l'écran de connexion, redemande un lien, et recommence indéfiniment sans
 * qu'un seul message ne lui explique pourquoi. Voir PUBLIC_PATHS dans
 * proxy-session.ts, où le chemin est déclaré.
 *
 * `verifyOtp` pose les cookies de session via le client `@supabase/ssr`, qui
 * écrit dans la réponse — on redirige donc APRÈS l'appel, jamais avant.
 */

const log = createLogger({ module: "auth-confirm" });

/** Où l'on atterrit une fois entré. Le tableau de bord, pas la page d'accueil :
 *  quelqu'un qui vient de cliquer sur son lien veut voir le produit, pas
 *  relire l'argumentaire. */
const DESTINATION = "/dashboard";

export async function GET(requete: NextRequest) {
  const params = requete.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  const echec = (motif: string) => {
    const url = new URL("/login", env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("lien", motif);
    return NextResponse.redirect(url);
  };

  /**
   * L'ERREUR DU FOURNISSEUR, LUE AVANT TOUT LE RESTE.
   *
   * Quand Google ou Supabase refuse, le retour arrive ici SANS `code` — mais
   * avec `error` et `error_description` dans l'URL. La route les ignorait :
   * elle constatait l'absence de code et renvoyait « lien invalide », le
   * message du lien magique. Quelqu'un qui venait de cliquer « Continuer avec
   * Google » lisait donc une phrase qui ne parlait pas de son problème, et le
   * vrai motif — le seul qui aurait permis de corriger — était jeté.
   *
   * Constaté en production le 2026-07-30 : trois retours à 307, aucun journal,
   * aucune piste. Un échec qu'on n'enregistre pas est un échec qu'on ne
   * corrige pas.
   */
  const erreurFournisseur = params.get("error");
  if (erreurFournisseur !== null) {
    log.warn("retour OAuth refusé par le fournisseur", {
      // Le code d'erreur et sa description sont des messages de protocole, pas
      // des données personnelles. Bornés, parce qu'un fournisseur peut y
      // mettre une page entière.
      erreur: erreurFournisseur.slice(0, 80),
      description: (params.get("error_description") ?? "").slice(0, 200),
    });
    return echec("fournisseur");
  }

  const code = params.get("code");
  const supabase = await createClient();

  /**
   * DEUX FORMES DE LIEN, et il faut accepter les deux.
   *
   * Le gabarit d'e-mail PAR DÉFAUT de Supabase envoie `{{ .ConfirmationURL }}` :
   * la personne passe d'abord par le point de vérification de Supabase, qui la
   * renvoie ici avec un `code` à échanger (flux PKCE). Un gabarit personnalisé
   * en `{{ .TokenHash }}` arrive au contraire directement ici avec un
   * `token_hash` à vérifier.
   *
   * N'en gérer qu'un seul, c'est faire dépendre la connexion d'un réglage de
   * gabarit invisible depuis le dépôt — et le jour où quelqu'un le modifie
   * dans le tableau de bord, plus personne n'entre, sans que rien ne l'explique.
   */
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({
          type: type === "signup" ? "signup" : "magiclink",
          token_hash: tokenHash,
        })
      : { error: { message: "ni code ni token_hash" } };

  if (!code && !tokenHash) {
    // Rien à vérifier — typiquement un lien tronqué par un client de
    // messagerie, ou une visite directe de l'URL.
    return echec("invalide");
  }

  if (error) {
    // Le jeton n'est jamais journalisé — seulement la raison du refus, qui est
    // presque toujours « expiré » ou « déjà utilisé ».
    log.warn("lien magique refusé", { raison: error.message });
    return echec("expire");
  }

  log.info("connexion par lien magique");
  return NextResponse.redirect(new URL(DESTINATION, env.NEXT_PUBLIC_APP_URL));
}
