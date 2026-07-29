import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import { buildCareerProfileFromRecords } from "@/lib/profile/linkedin-export";
import { recupererParcours } from "@/lib/profile/linkedin-mdp";
import {
  COOKIE_ETAT,
  echangerCode,
  linkedInConfigure,
} from "@/lib/profile/linkedin-oauth";
import { importerParcours } from "@/lib/profile/linkedin-import";
import type { MotifLinkedIn } from "@/lib/profile/linkedin-retour";

/**
 * Le retour de LinkedIn.
 *
 * Le jeton naît et meurt ICI : il est obtenu par l'échange, sert immédiatement
 * à lire le parcours, et n'est ni renvoyé au navigateur, ni écrit en base, ni
 * journalisé. C'est le seul endroit du produit où un secret d'utilisateur
 * existe, et il n'y survit pas à la requête.
 */

const log = createLogger({ module: "linkedin-callback" });

/**
 * `depots` accompagne le seul motif où un nombre veut dire quelque chose. Il
 * traverse l'URL parce que la redirection est la seule chose qui survive à
 * cette requête — et il est purement informatif : la page le réaffiche, ne
 * s'en sert pour aucune décision, et le rejette s'il est absurde.
 */
function retour(motif: MotifLinkedIn, depots?: number) {
  const url = new URL("/profile", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("linkedin", motif);
  if (depots !== undefined) url.searchParams.set("depots", String(depots));
  const reponse = NextResponse.redirect(url);
  // Le témoin d'état a fait son office : il ne doit pas survivre à l'échange.
  reponse.cookies.delete(COOKIE_ETAT);
  return reponse;
}

export async function GET(requete: NextRequest) {
  await verifySession();
  if (!linkedInConfigure()) return retour("indisponible");

  const params = requete.nextUrl.searchParams;

  // LinkedIn renvoie `error=user_cancelled_authorize` quand la personne refuse.
  // Un refus n'est pas une panne : on la ramène sans message d'échec.
  if (params.get("error")) return retour("annule");

  const code = params.get("code");
  const etatRecu = params.get("state");
  const etatEmis = requete.cookies.get(COOKIE_ETAT)?.value;

  // Comparaison stricte des deux états. Sans elle, un tiers pourrait faire
  // atterrir SON code d'autorisation dans la session de quelqu'un d'autre, et
  // ce serait le parcours d'un inconnu qui remplirait ce profil.
  if (!code || !etatRecu || !etatEmis || etatRecu !== etatEmis) {
    log.warn("retour linkedin rejeté", {
      aCode: code !== null,
      aEtat: etatRecu !== null,
      etatConcorde: etatRecu === etatEmis,
    });
    return retour("etat-invalide");
  }

  try {
    const jeton = await echangerCode(code);
    const { records, rapport } = await recupererParcours(jeton);
    const { text, skills } = buildCareerProfileFromRecords(records);
    const { deposees } = await importerParcours({ text, skills });
    const lignes = rapport.reduce((somme, r) => somme + r.lignes, 0);
    log.info("parcours linkedin importé", { lignes, deposees });
    // Une réponse vide n'est pas un échec — LinkedIn a répondu, poliment, sans
    // rien d'exploitable. La confondre avec une panne enverrait quelqu'un
    // réessayer indéfiniment un import qui marche déjà.
    return deposees === 0 ? retour("vide") : retour("ok", deposees);
  } catch (erreur) {
    // Les messages de LinkedInMdpError/LinkedInOAuthError sont rédigés pour être
    // lus et ne contiennent jamais le jeton ni le secret client.
    log.error("import linkedin échoué", {
      raison: erreur instanceof Error ? erreur.message : "inconnue",
    });
    return retour("echec");
  }
}
