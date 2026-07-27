import { z } from "zod";
import type { LinkedInRecords } from "./linkedin-export";

/**
 * Lecture PURE d'une page de l'API Member Snapshot (Member Data Portability).
 *
 * Séparé du module réseau pour la même raison que partout ailleurs ici : la
 * forme exacte des données renvoyées par LinkedIn n'est PAS documentée domaine
 * par domaine — seuls les libellés de PROFILE apparaissent dans un exemple.
 * Un module qu'on peut éprouver avec des charges utiles réelles, sans réseau,
 * est la seule façon d'avancer sans deviner.
 *
 * Ce que la documentation établit, et sur quoi ce fichier s'appuie :
 * - `elements` contient TOUJOURS exactement un élément, portant `snapshotDomain`
 *   et `snapshotData` ;
 * - `snapshotData` est une liste d'objets PLATS dont les clés sont des libellés
 *   lisibles avec espaces et majuscules (« First Name », « Zip Code »), jamais
 *   du camelCase ;
 * - les noms de domaines sont sensibles à la casse.
 *
 * Ce qu'elle n'établit PAS, et qu'on ne comble donc pas : les libellés exacts
 * de POSITIONS, EDUCATION, SKILLS et RECOMMENDATIONS. D'où `champsVus`, qui
 * remonte ce qui est réellement arrivé au lieu de laisser un import « réussir »
 * en ne trouvant rien.
 */

/** Seule version acceptée par ce point d'entrée ; toute autre échoue en 426. */
export const MDP_VERSION = "202312";

/** Nos clés pivot → les domaines LinkedIn, en majuscules (sensibles à la casse). */
export const DOMAINES = {
  profile: "PROFILE",
  positions: "POSITIONS",
  education: "EDUCATION",
  skills: "SKILLS",
  recommendationsReceived: "RECOMMENDATIONS",
  jobSeekerPreferences: "JOB_SEEKER_PREFERENCES",
} as const satisfies Record<keyof LinkedInRecords, string>;

export type ClePivot = keyof typeof DOMAINES;

const pageSchema = z.object({
  paging: z
    .object({ total: z.number().nullish(), start: z.number().nullish() })
    .nullish(),
  elements: z
    .array(
      z.object({
        snapshotDomain: z.string().nullish(),
        snapshotData: z.array(z.record(z.string(), z.unknown())).nullish(),
      }),
    )
    .nullish(),
});

/**
 * Une valeur de cellule, ramenée à du texte.
 *
 * Les objets et les tableaux sont ÉCARTÉS plutôt qu'aplatis : `buildCareerProfile`
 * produit un récit destiné à être lu par une personne puis par un modèle, et y
 * injecter du JSON brut donnerait du bruit qu'on prendrait pour du parcours.
 * Ce qui est écarté est comptabilisé par l'appelant, jamais perdu en silence.
 */
function texte(valeur: unknown): string | null {
  if (typeof valeur === "string") {
    const net = valeur.trim();
    return net === "" ? null : net;
  }
  if (typeof valeur === "number" && Number.isFinite(valeur)) {
    return String(valeur);
  }
  if (typeof valeur === "boolean") return valeur ? "true" : "false";
  return null;
}

export type PageLue = {
  domaine: string | null;
  /** Clés MINUSCULÉES — c'est le contrat de `LinkedInRecords`, et le respecter
   *  ici est la seule chose qui empêche l'import de ne rien trouver en silence. */
  lignes: Record<string, string>[];
  /** Les libellés réellement reçus, dans leur casse d'origine. Ils sont la
   *  seule preuve que la lecture a rencontré ce qu'elle croyait lire. */
  champsVus: string[];
};

export function lirePage(charge: unknown): PageLue {
  const analyse = pageSchema.safeParse(charge);
  if (!analyse.success) return { domaine: null, lignes: [], champsVus: [] };

  const element = (analyse.data.elements ?? [])[0];
  if (!element) {
    return {
      domaine: null,
      lignes: [],
      champsVus: [],
    };
  }

  const champsVus = new Set<string>();
  const lignes: Record<string, string>[] = [];
  for (const brute of element.snapshotData ?? []) {
    const ligne: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(brute)) {
      const libelle = cle.trim();
      if (libelle === "") continue;
      champsVus.add(libelle);
      const contenu = texte(valeur);
      if (contenu === null) continue;
      ligne[libelle.toLowerCase()] = contenu;
    }
    // Une ligne entièrement vide n'est pas une ligne : LinkedIn renvoie
    // beaucoup de champs à chaîne vide, et les compter comme des expériences
    // gonflerait un parcours avec du néant.
    if (Object.keys(ligne).length > 0) lignes.push(ligne);
  }

  return {
    domaine: element.snapshotDomain?.trim() || null,
    lignes,
    champsVus: [...champsVus],
  };
}

/**
 * Le domaine RECOMMENDATIONS mélange, d'après la documentation, celles que la
 * personne a REÇUES et celles qu'elle a ÉCRITES pour d'autres. Le champ qui les
 * distingue n'est pas documenté.
 *
 * Conséquence assumée : sans discriminant identifiable, on n'importe RIEN.
 * Verser dans le dossier de quelqu'un l'éloge qu'il a rédigé pour un tiers
 * serait la pire faute possible ici — le produit dit « voici pourquoi vous
 * pouvez défendre ce poste » en citant des preuves, et cette preuve-là parlerait
 * de quelqu'un d'autre. Ne rien remonter est récupérable ; se tromper de
 * personne ne l'est pas.
 */
export function recommandationsRecues(lignes: Record<string, string>[]): {
  gardees: Record<string, string>[];
  motifSiVide: string | null;
} {
  if (lignes.length === 0) return { gardees: [], motifSiVide: null };

  const cleDirection = Object.keys(lignes[0]).find(
    (c) => c.includes("direction") || c.includes("received"),
  );
  if (cleDirection === undefined) {
    return {
      gardees: [],
      motifSiVide:
        "LinkedIn n’a pas indiqué si ces recommandations ont été reçues ou écrites par vous ; aucune n’a été importée.",
    };
  }

  const gardees = lignes.filter((l) => {
    const v = (l[cleDirection] ?? "").toUpperCase();
    return v.includes("RECEIVED") || v === "TRUE";
  });
  return { gardees, motifSiVide: null };
}
