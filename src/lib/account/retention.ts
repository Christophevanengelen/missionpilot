/**
 * Les délais de rotation qu'on ne connaît pas encore.
 *
 * `null` veut dire « personne n'est allé vérifier », et surtout PAS « zéro ».
 * C'est l'invariant du produit appliqué à l'endroit où il coûte le plus cher :
 * l'écran de suppression de compte.
 *
 * Un chiffre plausible mais non vérifié est le seul mensonge que cet écran peut
 * produire sans qu'aucun test ne s'en aperçoive — « vos sauvegardes sont
 * remplacées au bout de 7 jours » se lit comme un engagement, et personne ne
 * saurait dire qu'il est faux. D'où la règle : tant que la valeur est `null`,
 * la copie dit qu'on ne sait pas.
 *
 * Un test unitaire rend l'un ou l'autre obligatoire selon la constante. Il est
 * impossible d'afficher un délai qui n'a pas été renseigné ici, et impossible
 * de laisser `null` en affichant un délai.
 *
 * POUR LES RENSEIGNER : la rotation des sauvegardes se lit dans la console
 * Supabase (Database → Backups) et dépend du plan ; la rétention des journaux
 * d'exécution se lit chez l'hébergeur. Reporter la valeur ici, et seulement
 * après l'avoir vue.
 */
export const RETENTION = {
  /** Rotation des sauvegardes de la base. */
  sauvegardesJours: null as number | null,
  /** Rétention des journaux d'exécution de l'hébergeur. */
  journauxHebergeurJours: null as number | null,
} as const;

/**
 * La phrase à afficher pour un délai — vérifié ou non.
 *
 * Retourne toujours une phrase complète : un écran qui doit choisir entre deux
 * formulations finit par en oublier une.
 */
export function phraseDelai(jours: number | null): string {
  return jours === null
    ? "Nous ne pouvons pas encore vous donner de délai exact pour cette rotation."
    : `Elles sont remplacées au bout de ${jours} jours.`;
}
