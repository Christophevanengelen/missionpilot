/**
 * Le partage — et la seule question qui compte : partager QUOI.
 *
 * LA RÈGLE QUI TIENT CE MODULE : on partage le PRODUIT, jamais la recherche.
 *
 * Ce n'est pas une préférence de discrétion, c'est une question de sécurité
 * pour les gens qui utilisent ce produit. Chercher un emploi se fait presque
 * toujours en poste, et presque toujours sans que l'employeur actuel le sache.
 * Un bouton « partagez votre recherche », même bien intentionné, met à un clic
 * d'un accident qui coûte un travail. Aucune fonction de ce fichier ne prend
 * de profil, d'offre, de métier cible ni d'identifiant en paramètre — le
 * périmètre du module rend la fuite impossible, ce qui vaut mieux qu'une
 * discipline d'appel.
 *
 * AUCUN PARAMÈTRE DE SUIVI, non plus. Le réflexe serait d'ajouter
 * `?via=partage` pour mesurer la viralité. Ça ne mesurerait rien ici — le
 * produit n'enregistre aucune visite, et il faudrait un traceur pour que le
 * paramètre serve, donc une ligne de plus dans la politique de
 * confidentialité. En prime, une URL paramétrée est une URL dupliquée aux yeux
 * d'un moteur de recherche. On partage donc l'adresse nue : plus honnête, et
 * meilleure pour le référencement.
 */

/** Ce qu'on écrit à la place de la personne — modifiable par elle avant envoi
 *  sur tous les réseaux qui le permettent. Court à dessein : un texte
 *  pré-rempli trop long se fait supprimer en entier plutôt que corriger. */
export const TEXTE =
  "MissionPilot : un moteur de recherche d'emploi qui lit votre parcours comme une trajectoire et vous montre le poste d'un cran au-dessus. Gratuit et open source.";

export const OBJET = "MissionPilot — on vous fait monter d'une marche";

export type Reseau = "linkedin" | "x" | "bluesky" | "email";

/**
 * L'URL d'intention pour un réseau donné.
 *
 * Des URL d'intention, pas des kits de développement : brancher le script de
 * partage de LinkedIn ou de X ferait entrer un traceur tiers sur une page qui
 * n'en a aucun, et le paierait en consentement à demander. Un lien ordinaire
 * fait le même travail, sans rien exécuter chez nous.
 */
export function lienReseau(reseau: Reseau, url: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(TEXTE);
  switch (reseau) {
    case "linkedin":
      // LinkedIn ignore tout texte pré-rempli depuis 2023 et compose l'aperçu
      // à partir des balises Open Graph de la page. C'est précisément pour ce
      // chemin-là que `opengraph-image.tsx` et `metadataBase` existent.
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "x":
      return `https://x.com/intent/post?text=${t}&url=${u}`;
    case "bluesky":
      // Bluesky n'a pas de champ d'URL séparé : le lien va dans le texte.
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${TEXTE} ${url}`)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(OBJET)}&body=${encodeURIComponent(`${TEXTE}\n\n${url}`)}`;
  }
}

/** Ce que l'API de partage native reçoit sur mobile — un objet, pas une URL. */
export function chargeNative(url: string): {
  title: string;
  text: string;
  url: string;
} {
  return { title: OBJET, text: TEXTE, url };
}
