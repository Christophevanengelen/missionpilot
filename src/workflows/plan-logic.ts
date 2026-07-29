import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/db/admin";
import { createLogger } from "@/lib/observability/logger";
import { buildProfileDossier } from "@/lib/matching/insight-logic";
import { loadAnswers } from "@/lib/profile/clarifications";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { calculerPlan } from "@/lib/search/plan-from-profile";
import {
  ecrirePlanPrecalcule,
  empreinteDossier,
  lirePlanPrecalcule,
} from "@/lib/search/plan-store";

/**
 * Le calcul du plan de recherche, sorti du chemin de rendu.
 *
 * La logique vit ici et non dans `plan.ts` pour la même raison que
 * `health-logic.ts` : une fonction Inngest est difficile à tester, une fonction
 * pure ne l'est pas. `plan.ts` ne fait que la brancher sur un événement.
 */

const log = createLogger({ module: "plan-workflow" });

export const planEventSchema = z.object({
  userId: z.string().uuid(),
  profileId: z.string().uuid(),
});

export type PlanEvent = z.infer<typeof planEventSchema>;

export type PlanOutcome =
  | { status: "written"; titles: number }
  | { status: "already-fresh" }
  | { status: "empty-dossier" }
  | { status: "not-owner" };

/**
 * Recalcule et range le plan.
 *
 * TROIS CHOSES QUI COMPTENT, dans cet ordre :
 *
 * 1. **La propriété est revérifiée ici.** Ce chemin écrit avec la clé secrète,
 *    donc hors RLS : la base ne protégera personne. Un événement qui prétend
 *    qu'un profil appartient à quelqu'un doit être confronté à la table avant
 *    qu'on n'écrive quoi que ce soit (contrôle compensatoire D7).
 * 2. **Le travail déjà fait n'est pas refait.** Deux visites rapprochées
 *    émettent deux événements ; recalculer deux fois coûterait six appels de
 *    modèle pour un résultat identique.
 * 3. **Un dossier vide n'est pas une erreur.** Quelqu'un qui vient de créer son
 *    compte n'a rien à analyser, et échouer bruyamment sur ce cas ferait passer
 *    l'état le plus normal du produit pour une panne.
 */
export async function recalculerPlan(event: PlanEvent): Promise<PlanOutcome> {
  const admin = createServiceClient();

  const { data: profil } = await admin
    .from("candidate_profiles")
    .select("id, user_id")
    .eq("id", event.profileId)
    .maybeSingle();

  if (!profil || profil.user_id !== event.userId) {
    // Jamais silencieux : sur un chemin qui contourne la RLS, un refus est la
    // seule trace qu'il reste si quelqu'un essaie.
    log.warn("plan refusé : le profil n'appartient pas à l'émetteur", {
      profileId: event.profileId,
    });
    return { status: "not-owner" };
  }

  // Les MÊMES chargeurs que l'écran, et c'est délibéré : un dossier construit
  // autrement ici produirait une empreinte différente de celle que le rendu
  // recalcule, et le plan ne serait jamais reconnu comme valable. Deux chemins
  // de lecture pour une même donnée finissent toujours par diverger.
  const [living, preferences, clarifications] = await Promise.all([
    loadLivingProfile(admin, profil.id),
    loadPreferences(admin, profil.id),
    loadAnswers(admin, profil.id),
  ]);

  const dossier = buildProfileDossier(
    living.claims,
    preferences,
    clarifications,
  );

  if (dossier.trim() === "") return { status: "empty-dossier" };

  const dejaLa = await lirePlanPrecalcule(admin, profil.id, dossier);
  if (dejaLa) return { status: "already-fresh" };

  const plan = await calculerPlan(
    dossier,
    preferences.targetRoleFamilies,
    living.claims,
  );
  await ecrirePlanPrecalcule(admin, profil.id, dossier, plan);

  log.info("plan recalculé", {
    profileId: profil.id,
    empreinte: empreinteDossier(dossier).slice(0, 12),
    titres: plan.searchedTitles.length,
    trajectoireLue: plan.trajectory !== null,
  });

  return { status: "written", titles: plan.searchedTitles.length };
}
