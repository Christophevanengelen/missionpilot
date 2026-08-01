/**
 * Les motifs d'écartement — le vocabulaire, et ce que chacun corrige.
 *
 * MODULE PUR, sans base ni session : c'est ce qui permet de tester la seule
 * chose qui puisse vraiment se tromper ici — la correspondance entre ce que la
 * personne dit et ce que le moteur en fait.
 *
 * POURQUOI UNE LISTE FERMÉE PLUTÔT QU'UN CHAMP LIBRE. Un champ libre serait
 * plus riche et ferait deux dégâts. D'abord il finirait par contenir du texte
 * de parcours — donc de la donnée personnelle, dans la seule table du produit
 * conçue pour n'en porter aucune. Ensuite il ne serait pas exploitable : cinq
 * cents formulations de « c'est trop junior » ne corrigent aucune recherche.
 * Cinq boutons en corrigent une.
 *
 * CHAQUE MOTIF DOIT DIRE OÙ LE MOTEUR SE TROMPE, pas ce que la personne
 * ressent. « Pas intéressant » n'est pas dans la liste : c'est un jugement,
 * il ne se traduit en aucune correction. « Pas le bon métier » désigne le plan
 * de recherche. C'est le critère d'admission d'un motif dans cette liste.
 */

export const MOTIFS = [
  "wrong_role",
  "too_junior",
  "too_senior",
  "wrong_place",
  "wrong_contract",
] as const;

export type Motif = (typeof MOTIFS)[number];

export function estMotif(valeur: unknown): valeur is Motif {
  return (
    typeof valeur === "string" && (MOTIFS as readonly string[]).includes(valeur)
  );
}

/** Ce que chaque motif désigne dans le moteur — la partie du réglage qui est
 *  en cause. Sert au libellé ET au diagnostic du tableau de pilotage. */
export const CIBLE: Record<Motif, "plan" | "niveau" | "zone" | "contrat"> = {
  wrong_role: "plan",
  too_junior: "niveau",
  too_senior: "niveau",
  wrong_place: "zone",
  wrong_contract: "contrat",
};

export type Comptes = Partial<Record<Motif, number>>;

/**
 * Le diagnostic : quel réglage est le plus souvent mis en cause.
 *
 * `null` tant qu'on n'a pas de quoi conclure. C'est le point important —
 * annoncer « votre zone est mal réglée » sur un seul écartement serait une
 * conclusion tirée d'un clic, et la personne le sentirait tout de suite.
 * Le seuil est bas (trois) parce que le produit sert une personne à la fois,
 * pas une cohorte : on n'attend pas la significativité statistique, on attend
 * de ne plus être dans le bruit d'un clic isolé.
 */
export const SEUIL_DIAGNOSTIC = 3;

export function reglageEnCause(
  comptes: Comptes,
): { cible: "plan" | "niveau" | "zone" | "contrat"; total: number } | null {
  const parCible = new Map<string, number>();
  for (const motif of MOTIFS) {
    const n = comptes[motif] ?? 0;
    if (n <= 0) continue;
    const cible = CIBLE[motif];
    parCible.set(cible, (parCible.get(cible) ?? 0) + n);
  }
  if (parCible.size === 0) return null;

  // Le plus cité, et en cas d'égalité on ne tranche pas : deux réglages à
  // égalité ne désignent rien, et désigner quand même serait inventer.
  const classe = [...parCible].sort((a, b) => b[1] - a[1]);
  if (classe.length > 1 && classe[0][1] === classe[1][1]) return null;
  const [cible, total] = classe[0];
  if (total < SEUIL_DIAGNOSTIC) return null;
  return { cible: cible as "plan" | "niveau" | "zone" | "contrat", total };
}

/** Le total, tous motifs confondus. */
export function totalEcarte(comptes: Comptes): number {
  return MOTIFS.reduce((n, m) => n + (comptes[m] ?? 0), 0);
}
