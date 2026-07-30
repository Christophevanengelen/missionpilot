import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Les quatre pages qu'un moteur peut réellement lire.
 *
 * Un sitemap n'est pas la liste des routes : c'est la liste de ce qui a du
 * sens SANS session. Tout le reste du produit exige d'être connecté, et
 * annoncer ces URL ferait perdre son temps à un robot pour lui servir une
 * redirection.
 *
 * `lastModified` est volontairement absent des documents légaux : ils portent
 * déjà leur propre date de version dans leur texte, et une date de fichier qui
 * bouge à chaque déploiement laisserait croire que la politique a changé alors
 * qu'on n'a corrigé qu'une virgule ailleurs. Mentir à un robot, c'est encore
 * mentir.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL;
  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // L'entrée : c'est là qu'aboutit quelqu'un qui cherche le produit par
      // son nom, et elle porte la promesse en entier.
      url: `${base}/login`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/confidentialite`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/conditions`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
