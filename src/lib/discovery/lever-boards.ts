/**
 * Les tableaux d'offres Lever interrogés par ce déploiement.
 *
 * Même régime que Greenhouse et Ashby : `api.lever.co/v0/postings` est l'API
 * que Lever publie pour que ses clients affichent leur tableau ailleurs que
 * sur leur site, sans authentification parce qu'elle est faite pour être lue
 * par des tiers.
 *
 * CE QUE CETTE SOURCE APPORTE : du marché intermédiaire français et européen,
 * là où Greenhouse et Ashby penchent vers les grandes sociétés de technologie
 * américaines. Le volume est plus modeste — c'est la couverture qui compte ici,
 * pas le nombre.
 *
 * Chaque jeton appelé le 2026-08-02 ; les chiffres sont ce que l'API a rendu
 * ce jour-là.
 */

export type LeverBoard = { jeton: string; nom: string };

export const EXCLUDED_LEVER: readonly string[] = [];

export const LEVER_BOARDS: readonly LeverBoard[] = [
  { jeton: "palantir", nom: "Palantir" }, // 302 offres, 50 en Europe
  { jeton: "spotify", nom: "Spotify" }, // 105 · 49
  { jeton: "aircall", nom: "Aircall" }, // 77 · 46
  /**
   * MALT EST ICI, ET CE N'EST PAS UNE CONTRADICTION — la distinction mérite
   * d'être écrite parce qu'elle se relit mal de mémoire.
   *
   * L'audit des sources range Malt dans les plateformes à ne jamais toucher.
   * Ce qui y est visé, ce sont **les missions freelance publiées PAR DES
   * CLIENTS sur la place de marché de Malt** : cette base leur appartient, ils
   * n'exposent aucune API publique, et l'extraire serait exactement le grief.
   *
   * Le tableau ci-dessous est autre chose : **les postes que Malt recrute POUR
   * ELLE-MÊME**, qu'elle publie de sa propre initiative sur Lever pour être
   * relayés. C'est Malt-employeur, pas Malt-place-de-marché. Le second reste
   * hors de portée ; le premier est un employeur comme les autres.
   */
  { jeton: "malt", nom: "Malt" }, // 36 · 36 — leurs propres recrutements
  { jeton: "agicap", nom: "Agicap" }, // 35 · 18
  { jeton: "swile", nom: "Swile" }, // 21 · 12
  { jeton: "pipedrive", nom: "Pipedrive" }, // 17 · 12
  { jeton: "jobandtalent", nom: "Jobandtalent" }, // 28 · 11
  { jeton: "contentsquare", nom: "Contentsquare" }, // 21 · 10
];

export function activeLeverBoards(
  boards: readonly LeverBoard[] = LEVER_BOARDS,
  excluded: readonly string[] = EXCLUDED_LEVER,
): LeverBoard[] {
  const out = new Set(excluded.map((b) => b.trim().toLowerCase()));
  const vus = new Set<string>();
  const actifs: LeverBoard[] = [];
  for (const board of boards) {
    const jeton = board.jeton.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(jeton)) continue;
    if (out.has(jeton) || vus.has(jeton)) continue;
    vus.add(jeton);
    actifs.push({ jeton, nom: board.nom.trim() || jeton });
  }
  return actifs;
}
