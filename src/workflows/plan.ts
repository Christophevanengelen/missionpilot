import { NonRetriableError } from "inngest";
import { inngest } from "@/workflows/client";
import { planEventSchema, recalculerPlan } from "@/workflows/plan-logic";

/**
 * Le plan de recherche, recalculé hors du chemin de rendu (Inngest SDK v4).
 *
 * `concurrency: 1` par profil, et c'est le réglage qui compte : sans lui, deux
 * onglets ouverts sur le tableau de bord lanceraient deux calculs simultanés
 * pour le même dossier, soit six appels de modèle pour un résultat unique. La
 * clé d'idempotence couvre les rejeux d'un même événement ; la concurrence
 * couvre les événements distincts qui veulent la même chose.
 */
export const planRecomputeFunction = inngest.createFunction(
  {
    id: "profile-search-plan",
    retries: 2,
    idempotency: "event.data.profileId",
    concurrency: { limit: 1, key: "event.data.profileId" },
    triggers: [{ event: "profile/plan.requested" }],
  },
  async ({ event, step }) => {
    const parsed = planEventSchema.safeParse(event.data);
    if (!parsed.success) {
      // Une charge malformée ne se répare pas en réessayant.
      throw new NonRetriableError("Invalid profile/plan.requested payload");
    }
    return await step.run("recompute-plan", () => recalculerPlan(parsed.data));
  },
);
