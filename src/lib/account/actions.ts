"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/admin";
import { verifySession } from "@/lib/auth/dal";
import { deleteAccountSchema } from "@/domain/account";
import { deleteAccount, type DeletionOutcome } from "@/lib/account/deletion";
import { readAccountData } from "@/lib/account/logic";
import { buildAccountExport, exportFilename } from "@/lib/account/export";
import { createLogger } from "@/lib/observability/logger";

const logger = createLogger({ module: "account" });

/** Témoin non falsifiable de la page /au-revoir. */
const COOKIE_ADIEU = "mp_adieu";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: "failed" | "unknown" };

/**
 * Emporter ses données (art. 20).
 *
 * Server Action et non Route Handler `GET` : un GET est déclenchable depuis un
 * site tiers par une simple balise, et ne peut pas rendre son erreur dans un
 * `role="alert"` à côté du bouton. Ici la personne reste sur sa page, quoi
 * qu'il arrive.
 */
export async function exporterMesDonneesAction(): Promise<ExportResult> {
  // HORS du try : verifySession() appelle redirect(), qui LÈVE. Dans le try, le
  // catch prendrait cette redirection pour une panne.
  const session = await verifySession();

  try {
    const client = await createClient();
    const sections = await readAccountData(client);
    const maintenant = new Date();
    const donnees = buildAccountExport(
      sections,
      { email: session.email },
      maintenant,
    );
    return {
      ok: true,
      filename: exportFilename(maintenant),
      json: JSON.stringify(donnees, null, 2),
    };
  } catch (error) {
    logger.error("account export failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "failed" };
  }
}

export type SuppressionResult =
  | { ok: true }
  | {
      ok: false;
      error: "failed" | "blocked" | "unknown" | "unavailable";
      ref?: string;
    };

/**
 * Supprimer son compte.
 *
 * L'entrée n'accepte AUCUN identifiant (`deleteAccountSchema` est `.strict()`
 * et ne contient qu'un booléen) : la cible vient exclusivement de la session
 * vérifiée. Il n'y a donc pas de paramètre à changer pour supprimer le compte
 * d'un autre.
 */
export async function supprimerCompteAction(
  input: unknown,
): Promise<SuppressionResult> {
  // Hors du try, pour la même raison que ci-dessus : `redirect()` lève, et
  // afficher « vos données sont intactes » à quelqu'un qu'on vient de
  // déconnecter serait faux et déroutant.
  const session = await verifySession();
  const ref = randomUUID();

  let outcome: DeletionOutcome;
  try {
    deleteAccountSchema.parse(input);
    outcome = await deleteAccount(createServiceClient(), session);
  } catch (error) {
    // Transport, délai dépassé, configuration absente : la décision du serveur
    // est INCONNUE. On ne dit surtout pas « rien n'a été supprimé » — on ne le
    // sait pas.
    logger.error("account deletion failed", {
      step: "call",
      ref,
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "unknown", ref };
  }

  if (!outcome.ok) {
    logger.error("account deletion refused", {
      step: outcome.step,
      kind: outcome.kind,
      ref,
    });
    return {
      ok: false,
      error: outcome.kind === "failed" ? "failed" : outcome.kind,
      ref,
    };
  }

  // Le compte n'existe plus. RIEN de ce qui suit ne peut plus l'annuler : tout
  // échec en aval est journalisé, jamais renvoyé comme un échec de suppression.
  try {
    const jar = await cookies();
    // Effacement direct du bocal à cookies, sans dépendre du réseau : la
    // session Supabase est morte côté serveur, mais son cookie ferait encore
    // croire au navigateur qu'elle vit.
    for (const c of jar.getAll()) {
      if (c.name.startsWith("sb-")) jar.delete(c.name);
    }
    jar.set(COOKIE_ADIEU, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/au-revoir",
      maxAge: 600,
    });
  } catch (error) {
    logger.error("post-deletion cookie cleanup failed", {
      mutation: "committed",
      ref,
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
  }

  // AUCUN redirect() ici : l'îlot client navigue lui-même. Rediriger depuis
  // l'action écraserait l'issue « inconnue », qui doit rester distincte du
  // succès — c'est la seule issue où la personne doit faire quelque chose de
  // particulier.
  return { ok: true };
}

/** Le témoin posé par la suppression, lu une seule fois par /au-revoir. */
export async function lireTemoinAdieu(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE_ADIEU)?.value === "1";
}
