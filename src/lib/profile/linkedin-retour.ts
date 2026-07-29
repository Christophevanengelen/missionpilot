/**
 * Le retour de LinkedIn, lu depuis l'URL.
 *
 * Le gestionnaire de retour (`/api/linkedin/callback`) ne rend jamais de page :
 * il redirige vers `/profile?linkedin=<motif>`. Sans ce module, ce motif était
 * écrit dans l'URL puis ignoré — quelqu'un partait autoriser LinkedIn, revenait,
 * et ne trouvait AUCUNE trace de ce qui venait de se passer. Ni « c'est arrivé »,
 * ni « vous avez refusé », ni « ça a échoué ». Un aller-retour hors du produit
 * qui se termine par un écran identique à celui qu'on avait quitté est la pire
 * fin possible : on ne sait pas s'il faut recommencer.
 *
 * Le module est pur, et c'est délibéré : la correspondance motif → message est
 * la seule chose qui puisse silencieusement se désaccorder du gestionnaire de
 * retour, donc c'est elle qu'on teste.
 */

/** Les motifs émis par `/api/linkedin/callback`. Toute autre valeur — une URL
 *  bricolée à la main, un vieux marque-page — ne doit RIEN afficher. */
export const MOTIFS = [
  "ok",
  "vide",
  "annule",
  "echec",
  "indisponible",
  "etat-invalide",
] as const;

export type MotifLinkedIn = (typeof MOTIFS)[number];

/**
 * `succes` : le parcours est là. `neutre` : rien n'est arrivé, et ce n'est la
 * faute de personne — un refus n'est pas une panne. `alerte` : quelque chose
 * s'est mal passé et la personne doit le savoir.
 */
export type TonRetour = "succes" | "neutre" | "alerte";

export const TON: Record<MotifLinkedIn, TonRetour> = {
  ok: "succes",
  vide: "neutre",
  // Un refus est une décision, pas un incident : l'afficher en rouge
  // reprocherait à quelqu'un d'avoir exercé le choix qu'on lui a proposé.
  annule: "neutre",
  echec: "alerte",
  indisponible: "neutre",
  "etat-invalide": "alerte",
};

/** Les motifs qui appellent `role="alert"`. Les autres passent en `role="status"`
 *  — annoncé au lecteur d'écran, mais sans interrompre. */
export function estAlerte(motif: MotifLinkedIn): boolean {
  return TON[motif] === "alerte";
}

/**
 * Lit le motif. Un paramètre répété (`?linkedin=ok&linkedin=echec`) arrive sous
 * forme de tableau : c'est une URL malformée, on n'en devine pas l'intention.
 */
export function lireMotif(
  valeur: string | string[] | undefined,
): MotifLinkedIn | null {
  if (typeof valeur !== "string") return null;
  return (MOTIFS as readonly string[]).includes(valeur)
    ? (valeur as MotifLinkedIn)
    : null;
}

/**
 * Le nombre d'affirmations déposées, tel que le gestionnaire de retour l'a
 * compté.
 *
 * Il vient de l'URL, donc il est falsifiable — sans aucune conséquence : le
 * seul effet d'un chiffre inventé est de se mentir à soi-même sur son propre
 * import. Ce qui compte est qu'une valeur absurde ne casse pas la phrase, d'où
 * `null` plutôt qu'un `NaN` ou un zéro qui se confondrait avec un import vide.
 */
export function lireDepots(
  valeur: string | string[] | undefined,
): number | null {
  if (typeof valeur !== "string" || !/^\d{1,4}$/.test(valeur)) return null;
  const n = Number(valeur);
  return n > 0 ? n : null;
}
