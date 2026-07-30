import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Ce fichier n'existait pas — et le proxy renvoyait `/robots.txt` vers
 * `/login` en 307.
 *
 * Constaté le 2026-07-30 : vingt-sept passages de robots dans les journaux de
 * production, tous refoulés vers un écran de connexion. Un moteur de recherche
 * qui demande les règles d'exploration et reçoit une redirection n'insiste
 * pas : il conclut que le site n'est pas explorable. Le produit était donc
 * INVISIBLE, non par choix mais par accident de configuration.
 *
 * Le correctif tient en deux morceaux, et les deux sont nécessaires : ce
 * fichier, et l'exclusion de `robots.txt` du filtre du proxy (`proxy.ts`) —
 * un robots.txt qui existe mais qu'on redirige ne vaut pas mieux qu'aucun.
 *
 * CE QU'ON INTERDIT, et pourquoi c'est aussi important que ce qu'on autorise :
 * tout l'espace connecté. Ces pages exigent une session, donc un robot n'y
 * verrait qu'une redirection — les référencer gaspille son budget
 * d'exploration et pollue l'index de pages vides. `/desabonnement` est public
 * par nécessité mais n'a rien à faire dans un index : on y arrive par un lien
 * d'e-mail, jamais par une recherche.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/profile",
          "/compte",
          "/diagnostics",
          "/desabonnement",
          "/au-revoir",
          "/auth/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
