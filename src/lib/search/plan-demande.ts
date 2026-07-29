import "server-only";

import { inngest } from "@/workflows/client";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger({ module: "plan-demande" });

/**
 * Demander un recalcul, sans jamais l'attendre.
 *
 * Toute la valeur du correctif tient dans cette phrase. Si cette fonction
 * devenait un jour bloquante, l'écran retrouverait ses vingt-cinq secondes, et
 * personne ne verrait le rapport avec ce fichier.
 *
 * L'envoi est donc ISOLÉ de son appelant : elle n'échoue jamais vers le haut.
 * Une file d'événements indisponible est ennuyeuse ; une page blanche parce
 * qu'une file d'événements est indisponible serait absurde.
 *
 * L'identifiant d'événement porte le profil : deux visites rapprochées pendant
 * qu'un calcul tourne ne déclenchent pas deux calculs.
 */
export async function demanderRecalculDuPlan(
  userId: string,
  profileId: string,
): Promise<void> {
  try {
    await inngest.send({
      id: `plan-${profileId}`,
      name: "profile/plan.requested",
      data: { userId, profileId },
    });
  } catch {
    // Sans identifiant ni détail : ce journal sert à repérer une file muette,
    // pas à tracer les personnes.
    log.warn("demande de recalcul du plan non envoyée");
  }
}
