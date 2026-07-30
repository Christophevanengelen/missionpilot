import "server-only";

import { createServiceClient } from "@/lib/db/admin";
import { createLogger } from "@/lib/observability/logger";
import type { CompteAnonyme, ProfilAnonyme } from "./metrics";

/**
 * La lecture — et le seul endroit du tableau de pilotage qui touche la base.
 *
 * CE QU'ON NE RAMÈNE PAS, et c'est la moitié du travail : aucune adresse,
 * aucun identifiant, aucun nom d'affichage, aucune affirmation de parcours.
 * Les requêtes ci-dessous sélectionnent des DATES et des COMPTEURS, jamais
 * l'identité de qui que ce soit. Un panneau d'administration qui ramène tout
 * « au cas où » finit toujours par l'afficher.
 *
 * La clé secrète est nécessaire — la RLS borne chaque table à son
 * propriétaire, ce qui est exactement ce qu'on veut partout ailleurs. Le
 * contrôle compensatoire est en amont : `verifyAdmin()` a déjà rendu un 404 à
 * quiconque n'est pas sur la liste, et la page est la seule à appeler ce
 * module.
 */

const log = createLogger({ module: "admin-collecte" });

export type Instantane = {
  /** L'instant où la mesure a été prise. Lu ICI et non au rendu : React
   *  interdit `Date.now()` pendant un rendu, et il a raison — un tableau de
   *  chiffres doit dire À QUELLE HEURE il a été établi, pas dépendre du
   *  moment où le navigateur a décidé de repeindre. */
  pris: number;
  comptes: CompteAnonyme[];
  profils: ProfilAnonyme[];
  /** `false` quand une lecture a échoué : l'écran doit alors dire qu'il ne
   *  sait pas, jamais afficher un zéro qui se lirait comme une mesure. */
  complet: boolean;
};

export async function lireInstantane(): Promise<Instantane> {
  const admin = createServiceClient();
  const vide: Instantane = {
    pris: Date.now(),
    comptes: [],
    profils: [],
    complet: false,
  };

  try {
    // ── Les comptes ────────────────────────────────────────────────────────
    // `listUsers` est paginé : on borne à 1 000, ce qui couvre très largement
    // une bêta privée. Au-delà, ces chiffres devront venir d'une vue SQL —
    // et ce commentaire sera le signal qu'on y est arrivé.
    const { data: page, error: erreurComptes } =
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
    if (erreurComptes) {
      log.error("comptes illisibles");
      return vide;
    }
    const comptes: CompteAnonyme[] = page.users.map((u) => ({
      creeLe: u.created_at,
      derniereConnexion: u.last_sign_in_at ?? null,
      emailConfirme: Boolean(u.email_confirmed_at),
    }));

    // ── Les profils, réduits à des signaux ─────────────────────────────────
    const { data: profils, error: erreurProfils } = await admin
      .from("candidate_profiles")
      .select("id, created_at, target_role_families");
    if (erreurProfils || !profils) {
      log.error("profils illisibles");
      return vide;
    }

    const { data: affirmations, error: erreurClaims } = await admin
      .from("profile_claims")
      .select("profile_id")
      .eq("state", "confirmed");
    if (erreurClaims) {
      log.error("affirmations illisibles");
      return vide;
    }

    const { data: preuves } = await admin
      .from("evidence_items")
      .select("profile_id");
    const { data: abonnements } = await admin
      .from("digest_subscriptions")
      .select("profile_id")
      .eq("opted_in", true);

    const parProfil = new Map<string, number>();
    for (const a of affirmations ?? []) {
      parProfil.set(a.profile_id, (parProfil.get(a.profile_id) ?? 0) + 1);
    }
    const avecPreuve = new Set((preuves ?? []).map((e) => e.profile_id));
    const abonnes = new Set((abonnements ?? []).map((d) => d.profile_id));

    return {
      pris: Date.now(),
      comptes,
      profils: profils.map((p) => ({
        creeLe: p.created_at,
        affirmationsConfirmees: parProfil.get(p.id) ?? 0,
        // `target_role_families` est typé `Json` : un tableau à l'exécution,
        // mais le type généré autorise aussi un nombre ou une chaîne. On le
        // vérifie plutôt que de le supposer — une colonne jsonb finit toujours
        // par contenir autre chose que ce qu'on croyait.
        aDesMetiersCibles:
          Array.isArray(p.target_role_families) &&
          p.target_role_families.length > 0,
        aDesPreuves: avecPreuve.has(p.id),
        abonneAuDigest: abonnes.has(p.id),
      })),
      complet: true,
    };
  } catch {
    log.error("instantané impossible");
    return vide;
  }
}
