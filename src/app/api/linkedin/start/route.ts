import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import {
  adresseRetour,
  COOKIE_ETAT,
  linkedInConfigure,
  urlAutorisation,
} from "@/lib/profile/linkedin-oauth";

/**
 * Le départ du « Remplir avec LinkedIn » : on émet un état, on le dépose en
 * cookie, et on envoie la personne chez LinkedIn.
 *
 * `verifySession` d'abord, toujours : sans elle, n'importe qui pourrait lancer
 * le flux et faire atterrir un parcours dans un profil qui n'est pas le sien.
 * L'authentification se vérifie là où la donnée est servie, jamais dans le
 * proxy — c'est la règle du dépôt, née de deux CVE de contournement de
 * middleware.
 */
export async function GET() {
  await verifySession();

  if (!linkedInConfigure()) {
    // Configuration absente : on ne montre pas d'erreur technique à quelqu'un
    // qui voulait juste importer son parcours. Le bouton n'aurait pas dû être
    // visible ; on le renvoie au profil, où l'autre chemin existe.
    return NextResponse.redirect(
      new URL("/profile?linkedin=indisponible", env.NEXT_PUBLIC_APP_URL),
    );
  }

  const etat = randomUUID();
  const reponse = NextResponse.redirect(
    urlAutorisation({
      clientId: env.LINKEDIN_CLIENT_ID as string,
      redirectUri: adresseRetour(),
      etat,
    }),
  );
  reponse.cookies.set(COOKIE_ETAT, etat, {
    httpOnly: true,
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    sameSite: "lax", // "strict" empêcherait le cookie de revenir depuis LinkedIn
    path: "/",
    maxAge: 600,
  });
  return reponse;
}
