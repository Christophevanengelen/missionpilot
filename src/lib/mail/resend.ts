import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";

/**
 * Envoyer un e-mail, et rien d'autre.
 *
 * POURQUOI PAS DE DÉPENDANCE. Le SDK Resend apporterait un client HTTP et un
 * modèle d'objets pour une seule requête POST dont on n'utilise que six
 * champs. Le dépôt appelle déjà OpenAI, Adzuna, France Travail et LinkedIn en
 * `fetch` nu, avec un délai d'attente explicite et un schéma Zod sur la
 * réponse : cette API n'est pas différente, et une dépendance de production se
 * justifie par ce qu'elle apporte, pas par ce qu'elle épargne d'écrire.
 *
 * CE MODULE NE DÉCIDE JAMAIS À QUI ÉCRIRE. Il reçoit une adresse et un
 * contenu. Le consentement, le désabonnement et l'idempotence se jouent chez
 * l'appelant, où ils sont visibles — un envoyeur qui consulterait lui-même une
 * table d'abonnés serait un endroit de plus où l'on peut oublier de vérifier.
 */

const TIMEOUT_MS = 15_000;
const RESEND_URL = "https://api.resend.com/emails";

const log = createLogger({ module: "mail-resend" });

/** Ce dont on a réellement besoin dans la réponse : l'identifiant du message,
 *  pour pouvoir retrouver un envoi dans le tableau de bord Resend. */
const reponseSchema = z.object({ id: z.string().min(1) });

export class MailError extends Error {}

/**
 * `true` quand l'application est en mesure d'envoyer.
 *
 * L'interrupteur compte autant que la clé : poser une clé prépare le terrain,
 * allumer l'envoi est une décision distincte.
 */
export function mailConfigure(): boolean {
  return (
    env.DIGEST_ENABLED === true &&
    Boolean(env.RESEND_API_KEY) &&
    Boolean(env.DIGEST_FROM)
  );
}

export type Courriel = {
  a: string;
  objet: string;
  html: string;
  /** La version texte, et elle n'est pas optionnelle chez nous : un e-mail
   *  sans elle part avec un score de spam plus élevé, et il est illisible pour
   *  qui lit son courrier en texte brut — ce qui reste le cas de gens qui
   *  cherchent un emploi depuis un terminal. */
  texte: string;
  /**
   * L'URL de désabonnement, promue en EN-TÊTE et pas seulement en pied de
   * page.
   *
   * `List-Unsubscribe` est ce qui fait apparaître le bouton « se désabonner »
   * natif de Gmail et d'Apple Mail. Sans lui, la seule sortie visible d'un
   * destinataire agacé est le bouton « spam », qui abîme la réputation du
   * domaine — donc, à terme, la délivrabilité des liens de connexion.
   */
  desabonnementUrl: string;
};

/**
 * Envoie, ou lève. L'appelant décide de ce qu'un échec signifie : pour la
 * tâche planifiée, c'est un destinataire à réessayer la semaine suivante, et
 * surtout pas une date de dernier envoi à écrire.
 */
export async function envoyerCourriel(courriel: Courriel): Promise<string> {
  const cle = env.RESEND_API_KEY;
  const expediteur = env.DIGEST_FROM;
  if (!cle || !expediteur) {
    throw new MailError("RESEND_API_KEY et DIGEST_FROM sont requis");
  }

  let reponse: Response;
  try {
    reponse = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        from: expediteur,
        to: [courriel.a],
        subject: courriel.objet,
        html: courriel.html,
        text: courriel.texte,
        headers: {
          "List-Unsubscribe": `<${courriel.desabonnementUrl}>`,
          // Déclare que le lien ci-dessus se contente d'un POST, sans page de
          // confirmation. C'est ce qui permet au bouton natif de désabonner en
          // un clic, ce qui est le comportement qu'on veut : une sortie plus
          // facile que le bouton « spam ».
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
  } catch (error) {
    // Le délai dépassé arrive ici. Journalisé SANS l'adresse : ce journal sert
    // à repérer un envoyeur muet, pas à tracer qui reçoit quoi.
    log.warn("envoi impossible", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new MailError("resend: requête impossible");
  }

  if (!reponse.ok) {
    log.warn("envoi refusé", { httpStatus: reponse.status });
    throw new MailError(`resend: HTTP ${reponse.status}`);
  }

  const parsed = reponseSchema.safeParse(await reponse.json());
  if (!parsed.success) {
    throw new MailError("resend: réponse inattendue");
  }
  return parsed.data.id;
}
