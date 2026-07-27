import "server-only";

import type { createServiceClient } from "@/lib/db/admin";
import type { SessionInfo } from "@/lib/auth/dal";

type Admin = ReturnType<typeof createServiceClient>;

export type DeletionOutcome =
  | { ok: true }
  | {
      ok: false;
      step: "deleteUser" | "verify";
      kind: "failed" | "blocked" | "unknown";
    };

/**
 * Supprimer un compte, et le PROUVER.
 *
 * Une seule instruction efface le schéma applicatif : la suppression de la
 * ligne `auth.users`. Les 16 tables tombent par action référentielle, y compris
 * `agent_runs` et `agent_steps` qui n'accordent aucun `delete` à personne — une
 * cascade s'exécute sous l'identité du propriétaire de la table, pas de
 * l'appelant. Les résidus du schéma `auth` sans clé étrangère
 * (`audit_log_entries` et ses adresses IP, `flow_state`, les `refresh_tokens`
 * hors session) sont purgés par le trigger `on_auth_user_deleted`, dans la même
 * transaction.
 *
 * PREND UN `SessionInfo`, JAMAIS UNE CHAÎNE. La règle de confinement du client
 * de service exige un contrôle d'appartenance explicite ; une signature
 * `(admin, userId: string)` inviterait le refactor qui va chercher l'identifiant
 * dans la requête plutôt que dans la session vérifiée.
 */
export async function deleteAccount(
  admin: Admin,
  session: SessionInfo,
): Promise<DeletionOutcome> {
  // `shouldSoftDelete` EXPLICITEMENT false. À `true`, la ligne `auth.users`
  // reste en place, AUCUNE cascade ne part, rien n'est effacé — et l'écran de
  // confirmation s'afficherait quand même. C'est le pire échec possible de
  // cette fonctionnalité : une promesse d'effacement tenue par un message.
  const { error } = await admin.auth.admin.deleteUser(session.userId, false);

  // On teste `error`, jamais `data.user` : le serveur répond 200 avec un objet
  // vide. Un 404 signifie « déjà supprimé » — c'est un succès, pas un échec :
  // c'est le second clic de quelqu'un dont la connexion a coupé.
  if (error && error.status !== 404) {
    return { ok: false, step: "deleteUser", kind: "failed" };
  }

  // LA POST-CONDITION — la seule preuve.
  //
  // Trois façons distinctes d'obtenir un 200 sans avoir rien effacé : une
  // suppression douce, un compte déjà marqué supprimé, ou un refactor qui
  // passerait un objet d'options en deuxième argument. Toutes affichent
  // « votre compte a été supprimé » sur un mensonge. On relit.
  const { data, error: verifyError } = await admin.auth.admin.getUserById(
    session.userId,
  );
  if (data?.user) {
    return { ok: false, step: "verify", kind: "blocked" };
  }
  if (verifyError && verifyError.status !== 404) {
    return { ok: false, step: "verify", kind: "unknown" };
  }

  return { ok: true };
}
