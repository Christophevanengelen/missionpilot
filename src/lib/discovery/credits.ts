/**
 * The credits a source contractually requires when its data is displayed.
 *
 * Per-result attribution — a named source and a link back on each card — is
 * already handled. Several sources ask for something else on top: a visible
 * credit for the SET of results, naming them and linking to their site. Adzuna
 * is the strict one ("Jobs by Adzuna", with "Jobs" hyperlinked); Remote OK
 * makes a dofollow link and a named mention a condition of continued access.
 *
 * Two design rules:
 *
 * 1. **Driven by what is actually on screen.** A credit is owed for data
 *    displayed, so it is computed from the sources that really produced the
 *    visible results — never from what happens to be configured. Crediting a
 *    source that returned nothing would be a false statement about where these
 *    offers came from, which is the same honesty rule the whole product runs
 *    on, pointed at ourselves.
 * 2. **Unknown sources get no credit line.** Silence is the safe default: an
 *    invented obligation is noise, and a missing one is caught by the registry
 *    review rather than guessed at here.
 *
 * CE QUI EST COUVERT, ET CE QUI NE L'EST PAS. La clause Adzuna a deux moitiés
 * mesurables : la formulation exacte (« Jobs by Adzuna », « Jobs » en lien) et
 * une taille minimale de 116 × 23 px. Les deux sont désormais rendues — la
 * seconde par `badge`, qui donne au crédit la surface exigée au lieu de le
 * laisser se fondre dans une ligne de bas de page.
 *
 * CE QUI RESTE OUVERT, et qu'aucun code ne referme : Adzuna publie sa propre
 * image de badge, et rien dans leurs conditions ne dit clairement si une
 * composition typographique équivalente est acceptée ou si leur fichier est
 * obligatoire. Nous ne reproduisons PAS leur marque de notre côté — dessiner
 * un logo Adzuna nous-mêmes serait un problème plus grave que celui qu'on
 * cherche à régler. Si leur fichier est exigé, il suffit de le déposer et de
 * pointer le badge dessus.
 *
 * Et surtout : leur palier gratuit est NON COMMERCIAL. Aucun badge ne règle
 * ça. C'est une licence à signer ou une source à retirer, et c'est la décision
 * du propriétaire — voir docs/opportunity-sources.md.
 */

export type SourceCredit = {
  source: string;
  /** Text before the link. */
  prefix: string;
  /** The linked words — Adzuna requires "Jobs" specifically. */
  linkText: string;
  href: string;
  /** Text after the link. */
  suffix: string;
  /**
   * Dimensions minimales, en pixels, quand la clause impose un BADGE et pas
   * seulement une mention.
   *
   * Le chiffre vit ici parce que c'en est un de contrat, pas de maquette :
   * Adzuna écrit « at least 116 × 23 px ». Le cacher derrière une classe
   * utilitaire le rendrait modifiable par quelqu'un qui ajuste une marge, sans
   * savoir qu'il touche à une obligation.
   *
   * Absent = une mention en ligne suffit, ce qui est le cas de toutes les
   * autres sources auditées.
   */
  badge?: { minWidth: number; minHeight: number };
};

const CREDITS: Record<string, Omit<SourceCredit, "source">> = {
  Adzuna: {
    prefix: "",
    linkText: "Jobs",
    href: "https://www.adzuna.co.uk",
    suffix: " by Adzuna",
    badge: { minWidth: 116, minHeight: 23 },
  },
  "Remote OK": {
    prefix: "Offres à distance par ",
    linkText: "Remote OK",
    href: "https://remoteok.com",
    suffix: "",
  },
  Jobicy: {
    prefix: "Offres à distance par ",
    linkText: "Jobicy",
    href: "https://jobicy.com",
    suffix: "",
  },
  Himalayas: {
    prefix: "Offres à distance par ",
    linkText: "Himalayas",
    href: "https://himalayas.app",
    suffix: "",
  },
  Remotive: {
    prefix: "Offres à distance par ",
    linkText: "Remotive",
    href: "https://remotive.com",
    suffix: "",
  },
};

/**
 * The credits owed for a set of displayed results, de-duplicated and in a
 * stable order so the block does not reshuffle between renders.
 */
export function creditsFor(
  sourceNames: readonly (string | null)[],
): SourceCredit[] {
  const seen = new Set<string>();
  const credits: SourceCredit[] = [];
  for (const name of sourceNames) {
    if (name === null) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const credit = CREDITS[name];
    if (credit === undefined) continue;
    credits.push({ source: name, ...credit });
  }
  return credits.sort((a, b) => a.source.localeCompare(b.source));
}
