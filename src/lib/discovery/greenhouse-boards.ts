/**
 * Les tableaux d'offres Greenhouse interrogés par ce déploiement.
 *
 * MÊME FORME JURIDIQUE QUE RECRUITEE, et c'est la raison d'être de cette
 * source. `boards-api.greenhouse.io` est l'API que Greenhouse publie POUR QUE
 * les employeurs affichent leur tableau d'offres ailleurs que sur leur propre
 * site : elle répond sans authentification parce qu'elle est faite pour être
 * lue par des tiers. On ne contourne rien et on ne devine rien — l'employeur a
 * choisi d'y publier.
 *
 * POURQUOI UNE LISTE ÉCRITE DANS LE CODE. Greenhouse ne publie aucun annuaire
 * de ses clients : il n'existe pas d'endpoint « lister tous les tableaux ». Le
 * jeton doit être connu à l'avance, et c'est ça — pas la pagination — la vraie
 * contrainte d'intégration. La liste est donc :
 *
 * - **bornée**, parce qu'une visite a un budget de latence, et qu'une source
 *   qui ralentit le produit est une source qu'on finit par éteindre ;
 * - **curée hors ligne**, parce que « quels employeurs interroge-t-on » est une
 *   décision qui doit se lire dans un diff et pouvoir être contestée ;
 * - **vérifiée**, pas devinée : chaque jeton ci-dessous a été appelé le
 *   2026-08-02, et le chiffre en commentaire est ce que l'API a réellement
 *   rendu ce jour-là. Aucun n'a été ajouté « parce que la société est connue ».
 *
 * COMME POUR RECRUITEE, cette liste est une liste d'EMPLOYEURS, pas d'offres.
 * Aucune annonce n'est stockée, chaque requête est en direct, chaque lien est
 * sortant. L'invariant « on ne stocke aucune offre » tient — mais l'exception
 * est réelle et elle est dite plutôt que passée sous silence.
 */

/**
 * Les tableaux qu'un employeur a demandé qu'on cesse d'interroger.
 *
 * Vide aujourd'hui, et présente quand même : un mécanisme de retrait ajouté
 * après la première plainte est un mécanisme arrivé en retard. La porte existe
 * avant d'être poussée — l'adresse de contact est dans la politique de
 * confidentialité.
 */
export const EXCLUDED_BOARDS: readonly string[] = [];

/**
 * Les tableaux interrogés.
 *
 * Ordonnés par nombre d'offres EUROPÉENNES constatées, pas par notoriété :
 * c'est ce que la personne devant l'écran peut réellement viser. Un tableau à
 * zéro offre européenne a été écarté même quand il en portait des centaines
 * ailleurs — `cloudflare` (284 offres, aucune en Europe) est le cas d'école,
 * et il est nommé ici pour que personne ne le rajoute par réflexe.
 */
export const GREENHOUSE_BOARDS: readonly string[] = [
  "celonis", // 238 offres, 143 en Europe
  "databricks", // 803 · 138
  "hellofresh", // 333 · 131
  "mongodb", // 399 · 104
  "doctolib", // 156 · 103
  "datadog", // 429 · 96
  "stripe", // 548 · 95
  "wolt", // 256 · 88
  "elastic", // 232 · 79
  "n26", // 77 · 77 — la totalité de leurs offres est européenne
  "grafanalabs", // 142 · 76
  "adyen", // 226 · 75
  "gitlab", // 184 · 51
  "asana", // 143 · 47
  "trustpilot", // 46 · 33
  "figma", // 176 · 32
  "twilio", // 182 · 27
  "samsara", // 308 · 22
  "algolia", // 40 · 20
  "vercel", // 81 · 15
  "collibra", // 41 · 10
  "dataiku", // 20 · 6
  "airtable", // 40 · 4
  "showpad", // 30 · 3
  // ── Deuxième passe de curation, 2026-08-02 ──────────────────────────────
  // Cherchée délibérément du côté des sociétés EUROPÉENNES : la première passe
  // avait ramené surtout des grandes sociétés américaines, dont la part
  // européenne des offres est faible. Ici le rapport s'inverse — `sumup` rend
  // 285 offres européennes sur 372, `bitpanda` 43 sur 44.
  "sumup", // 372 · 285
  "getyourguide", // 56 · 47
  "bitpanda", // 44 · 43
  "raisin", // 31 · 28
  "solarisbank", // 34 · 28
  "contentful", // 27 · 16
  "moonfare", // 10 · 10
  "typeform", // 12 · 10
  "konux", // 4 · 4
];

/** Les tableaux réellement interrogés : la liste curée moins les retraits. */
export function activeBoards(
  boards: readonly string[] = GREENHOUSE_BOARDS,
  excluded: readonly string[] = EXCLUDED_BOARDS,
): string[] {
  const out = new Set(excluded.map((b) => b.trim().toLowerCase()));
  const seen = new Set<string>();
  const actifs: string[] = [];
  for (const brut of boards) {
    const board = brut.trim().toLowerCase();
    // Le jeton entre dans un chemin d'URL. Tout ce qui n'est pas une étiquette
    // simple est ÉCARTÉ plutôt qu'échappé : un `../` ou un `@` enverrait la
    // requête ailleurs, et aucun jeton légitime n'en contient.
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(board)) continue;
    if (out.has(board) || seen.has(board)) continue;
    seen.add(board);
    actifs.push(board);
  }
  return actifs;
}
