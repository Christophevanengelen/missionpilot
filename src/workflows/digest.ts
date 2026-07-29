import { NonRetriableError } from "inngest";
import { inngest } from "@/workflows/client";
import {
  destinatairesDuJour,
  digestEventSchema,
  envoyerDigest,
} from "@/workflows/digest-logic";

/**
 * Le digest hebdomadaire, en deux fonctions et non en une.
 *
 * POURQUOI DEUX. Une seule fonction qui balaierait les abonnés ET leur
 * écrirait aurait deux défauts qu'on ne rattrape pas ensuite :
 *
 * 1. Un destinataire dont la recherche échoue ferait rejouer TOUTE la fonction
 *    au réessai — donc réenverrait aux personnes déjà servies.
 * 2. La durée d'exécution croîtrait avec le nombre d'abonnés, jusqu'à dépasser
 *    la limite un jour qu'on n'aurait pas choisi.
 *
 * Le balayage émet un événement par personne ; l'envoi traite une personne.
 * Chacun réessaie pour son propre compte.
 */

/** Lundi 7h00 UTC. Un digest reçu le lundi matin se lit ; reçu le vendredi
 *  soir, il attend le lundi et il est périmé — les offres ont trois jours. */
export const digestScanFunction = inngest.createFunction(
  {
    id: "digest-hebdomadaire-balayage",
    retries: 1,
    triggers: [{ cron: "0 7 * * 1" }],
  },
  async ({ step }) => {
    const destinataires = await step.run("lister-les-abonnes", () =>
      destinatairesDuJour(),
    );
    if (destinataires.length === 0) return { emis: 0 };

    await step.sendEvent(
      "emettre-les-envois",
      destinataires.map((d) => ({
        // L'identifiant porte le profil ET la semaine : deux balayages le même
        // jour — un rejeu, une reprise après incident — ne produisent qu'un
        // seul envoi. Sans la semaine, il n'y en aurait jamais qu'un, une fois
        // pour toutes.
        id: `digest-${d.profileId}-${new Date().toISOString().slice(0, 10)}`,
        name: "digest/envoi.demande",
        data: d,
      })),
    );
    return { emis: destinataires.length };
  },
);

/**
 * `concurrency` bornée : le digest lance une recherche multi-sources par
 * abonné, et les plateformes que nous interrogeons n'ont pas à encaisser tous
 * nos abonnés en même temps. C'est la leçon des 429 du 2026-07-29, appliquée
 * avant d'en avoir besoin plutôt qu'après.
 */
export const digestSendFunction = inngest.createFunction(
  {
    id: "digest-hebdomadaire-envoi",
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: "digest/envoi.demande" }],
  },
  async ({ event, step }) => {
    const parsed = digestEventSchema.safeParse(event.data);
    if (!parsed.success) {
      // Une charge malformée ne se répare pas en réessayant.
      throw new NonRetriableError("Invalid digest/envoi.demande payload");
    }
    return await step.run("envoyer", () => envoyerDigest(parsed.data));
  },
);
