import { z } from "zod";

/**
 * Les tables qui portent quelque chose de la personne.
 *
 * Cette liste sert deux usages qui doivent rester d'accord : ce qu'on EXPORTE
 * (art. 20, droit à la portabilité) et ce qu'on COMPTE avant de supprimer. Une
 * table oubliée ici est une table qu'on n'aurait pas rendue à quelqu'un qui
 * demande ses données — et un chiffre faux sur l'écran le plus irréversible du
 * produit.
 *
 * Le test pgTAP `account_deletion.test.sql` vérifie de son côté que toute table
 * de `public` atteint `auth.users` par une cascade. Les deux garde-fous se
 * complètent : l'un empêche d'oublier d'effacer, l'autre d'oublier de rendre.
 */
export const PERSONAL_TABLES = [
  "candidate_profiles",
  "profile_versions",
  "profile_claims",
  "evidence_items",
  "claim_evidence_links",
  "profile_clarifications",
  /* Le plan de recherche précalculé. C'est une DÉDUCTION sur la personne — sa
     trajectoire lue par un modèle, les intitulés qu'on cherche en son nom —
     donc une donnée personnelle au sens de l'art. 4(1), même si elle n'a
     jamais été saisie par elle. L'omettre de l'export en ferait un profilage
     invisible dans le document censé tout montrer. */
  "profile_search_plans",
  "opportunities",
  "opportunity_snapshots",
  "opportunity_tracking",
  "ai_match_insights",
  "ai_match_breakdowns",
  "ai_application_drafts",
  /* Les variantes de CV : nommées, régies et libellées par la personne — ses
     propres mots sur quand utiliser quel CV. Le brouillon de candidature les
     référence ; la liste elle-même se rend aussi. */
  "cv_variants",
  /* Le contrat de ton : les règles de voix de la personne (registre, ce qu'il
     faut éviter, formules d'appel et de politesse en français et en
     anglais), en ajout seul — publier une version n'efface jamais la
     précédente. Le brouillon de candidature enregistre exactement sous
     quelle version il a été écrit. */
  "tone_contracts",
  /* Le registre des envois : ce que la personne a réellement envoyé, quand, par
     quel canal, avec quelle variante de CV, et si c'est arrivé. C'est SON
     historique de candidature — la donnée la plus directement personnelle du
     produit après le profil lui-même, et celle qu'on lui doit en premier si
     elle demande son dossier. Le produit n'envoie rien : il enregistre. */
  "application_dispatches",
  "ai_interview_briefs",
  "agent_runs",
  "agent_steps",
  "system_health_results",
] as const;

export type PersonalTable = (typeof PERSONAL_TABLES)[number];

/**
 * Aucun identifiant en entrée, et c'est le contrôle principal.
 *
 * `.strict()` refuse tout champ supplémentaire. Il n'y a donc pas de paramètre
 * à changer pour supprimer le compte de quelqu'un d'autre : l'identité vient
 * exclusivement de `verifySession()`, jamais de la requête. Une signature qui
 * accepterait un `userId` inviterait, tôt ou tard, le refactor qui le lit
 * depuis l'entrée.
 */
export const deleteAccountSchema = z
  .object({ confirmation: z.literal(true) })
  .strict();

/**
 * Fenêtre de fraîcheur d'authentification avant un acte irréversible.
 *
 * Quinze minutes : assez pour que quelqu'un qui vient de se connecter aille au
 * bout de sa décision sans être renvoyé à la connexion, assez court pour qu'un
 * poste laissé ouvert ne suffise pas.
 */
export const MAX_AUTH_AGE_SECONDS = 900;
