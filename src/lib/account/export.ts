import { PERSONAL_TABLES, type PersonalTable } from "@/domain/account";
import { RETENTION, phraseDelai } from "@/lib/account/retention";

/**
 * L'export des données (art. 20 RGPD — droit à la portabilité).
 *
 * Module PUR : aucune base, aucun réseau. Il assemble un objet à partir de ce
 * qu'on lui donne, ce qui le rend testable ligne à ligne — et c'est le genre de
 * code où une régression silencieuse est coûteuse, parce qu'un export incomplet
 * ne ressemble pas à un bug : il ressemble à un export.
 */

export type SectionsLues = Partial<Record<PersonalTable, unknown[]>>;

export type AccountExport = {
  readonly format: "missionpilot-export";
  readonly version: 1;
  readonly genereLe: string;
  readonly compte: { readonly email: string | null };
  readonly donnees: Record<PersonalTable, unknown[]>;
  /**
   * Les sections qu'on n'a pas pu produire. Vide si tout a été lu.
   * Sa présence dans le fichier est délibérée : quelqu'un qui reçoit un export
   * doit pouvoir savoir qu'il est partiel, sinon l'absence se lit comme un zéro.
   */
  readonly sectionsNonLues: readonly PersonalTable[];
  readonly nonInclus: readonly string[];
};

/**
 * Ce que l'export NE CONTIENT PAS, et qui doit voyager avec lui.
 *
 * Un fichier qui se présente comme « toutes vos données » sans dire ce qu'il
 * laisse dehors est trompeur par omission. La liste est la même que celle
 * affichée avant la suppression — deux endroits, une seule vérité.
 */
export const NON_INCLUS: readonly string[] = [
  "Les sauvegardes chiffrées de notre base, jusqu'à leur rotation. " +
    phraseDelai(RETENTION.sauvegardesJours) +
    " Nous ne les consultons pas.",
  "Les journaux d'exécution de notre hébergeur : horodatages, adresses IP et " +
    "chemins d'URL, sans lien avec votre profil. " +
    phraseDelai(RETENTION.journauxHebergeurJours),
  // Formulation volontairement SANS DÉICTIQUE : cette liste est affichée à deux
  // endroits — dans le fichier d'export et dans le panneau de suppression. Un
  // « ce fichier » ou un « ci-dessus » est juste dans l'un et ne désigne rien
  // dans l'autre. Une phrase qui voyage doit tenir debout partout où elle va.
  "Ce qui a été transmis à OpenAI pour analyse — texte de votre CV, extraits " +
    "d'annonces — et qui relève de sa propre durée de conservation. Ce qu'il " +
    "nous a renvoyé, lui, est bien dans nos bases : il part dans votre export, " +
    "et disparaît avec votre compte.",
  "Les mots-clés dérivés de votre profil envoyés aux plateformes d'offres à " +
    "chaque recherche. Ces requêtes figurent dans leurs journaux, qui ne nous " +
    "appartiennent pas.",
  "Les e-mails de connexion déjà reçus : ils sont dans votre boîte, et vous " +
    "seul pouvez les effacer.",
];

/**
 * Assemble l'export.
 *
 * Les 16 sections sont TOUJOURS présentes, vides le cas échéant. Une section
 * absente et une section vide se ressemblent trop dans un fichier JSON : la
 * première veut dire « on n'a pas su lire », la seconde « vous n'avez rien
 * ici ». Les confondre, c'est laisser quelqu'un croire qu'il a tout reçu.
 *
 * `sectionsNonLues` est calculé par DIFFÉRENCE entre la liste de référence et
 * ce qui a été effectivement produit — et non alimenté par les `catch` de
 * l'appelant. L'absence la plus probable n'est pas l'erreur attrapée : c'est
 * l'oubli d'ajouter une table à la boucle de lecture.
 */
export function buildAccountExport(
  sections: SectionsLues,
  compte: { email: string | null },
  genereLe: Date,
): AccountExport {
  const donnees = {} as Record<PersonalTable, unknown[]>;
  const nonLues: PersonalTable[] = [];

  for (const table of PERSONAL_TABLES) {
    const lignes = sections[table];
    if (lignes === undefined) {
      donnees[table] = [];
      nonLues.push(table);
    } else {
      donnees[table] = lignes;
    }
  }

  return {
    format: "missionpilot-export",
    version: 1,
    genereLe: genereLe.toISOString(),
    compte,
    donnees,
    sectionsNonLues: nonLues,
    nonInclus: NON_INCLUS,
  };
}

/** `missionpilot-donnees-2026-07-27.json` */
export function exportFilename(date: Date): string {
  const jour = date.toISOString().slice(0, 10);
  return `missionpilot-donnees-${jour}.json`;
}

/**
 * Le décompte montré avant la suppression.
 *
 * Une ligne dont le compte vaut zéro n'est pas affichée : « 0 preuve » occupe
 * de la place pour ne rien apprendre, et allonge une liste que la personne doit
 * lire au moment le moins confortable.
 */
export type Empreinte = Partial<Record<PersonalTable, number>>;

export function lignesEmpreinte(empreinte: Empreinte): string[] {
  const n = (t: PersonalTable) => empreinte[t] ?? 0;
  const pluriel = (compte: number, un: string, plusieurs: string) =>
    `${compte} ${compte > 1 ? plusieurs : un}`;

  const lignes: string[] = [];

  if (n("candidate_profiles") > 0) {
    const versions = n("profile_versions");
    lignes.push(
      versions > 0
        ? `votre profil de travail et ${pluriel(versions, "version publiée", "versions publiées")}`
        : "votre profil de travail",
    );
  }
  if (n("profile_claims") > 0 || n("evidence_items") > 0) {
    const parts: string[] = [];
    if (n("profile_claims") > 0)
      parts.push(
        pluriel(n("profile_claims"), "élément confirmé", "éléments confirmés"),
      );
    if (n("evidence_items") > 0)
      parts.push(pluriel(n("evidence_items"), "preuve", "preuves"));
    lignes.push(parts.join(" et "));
  }
  if (n("profile_clarifications") > 0) {
    lignes.push(
      pluriel(
        n("profile_clarifications"),
        "réponse à nos questions",
        "réponses à nos questions",
      ),
    );
  }
  if (n("opportunities") > 0) {
    const suivies = n("opportunity_tracking");
    lignes.push(
      suivies > 0
        ? `${pluriel(n("opportunities"), "offre importée", "offres importées")}, dont ${suivies} ${suivies > 1 ? "suivies" : "suivie"}`
        : pluriel(n("opportunities"), "offre importée", "offres importées"),
    );
  }
  const analyses =
    n("ai_match_insights") +
    n("ai_match_breakdowns") +
    n("ai_application_drafts") +
    n("ai_interview_briefs");
  if (analyses > 0) {
    lignes.push(
      `${pluriel(analyses, "analyse écrite", "analyses écrites")} pour vous par l'IA`,
    );
  }
  if (n("agent_runs") > 0) {
    lignes.push(
      `${pluriel(n("agent_runs"), "exécution d'agent", "exécutions d'agent")} et leurs traces techniques`,
    );
  }

  return lignes;
}
