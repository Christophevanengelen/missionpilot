import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createClient } from "@/lib/db/server";

export type SessionInfo = {
  userId: string;
  email: string | null;
};

/**
 * Data Access Layer — the real authentication boundary.
 * `getSessionClaims` verifies the JWT via supabase.auth.getClaims() (never
 * getSession() on the server); React cache() deduplicates within a request.
 */
export const getSessionClaims = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return null;
  }
  return {
    userId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

/**
 * Call from EVERY protected page, Server Action and Route Handler.
 * Layout-level checks are not sufficient (layouts do not re-render on
 * client-side navigation).
 */
export async function verifySession(): Promise<SessionInfo> {
  const session = await getSessionClaims();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Les adresses autorisées, normalisées une fois.
 *
 * Minuscules et sans espaces : une liste saisie à la main dans une console de
 * déploiement contient tôt ou tard « Alice@… » ou une virgule suivie d'un
 * espace, et une comparaison stricte refuserait alors la bonne personne sans
 * rien expliquer.
 */
function adressesAdmin(): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a !== "");
}

/** `true` si CETTE adresse est sur la liste. Exporté pour être testé sans
 *  session ni base. */
export function estAdmin(email: string | null): boolean {
  if (email === null) return false;
  return adressesAdmin().includes(email.trim().toLowerCase());
}

/**
 * À appeler depuis CHAQUE surface d'administration.
 *
 * `notFound()` et non une erreur d'autorisation : un 403 confirme que la page
 * existe, et un compte curieux apprendrait ainsi qu'il y a quelque chose à
 * forcer. Un 404 ne dit rien. La différence ne protège pas d'un attaquant
 * déterminé — elle évite d'attirer l'attention, ce qui est déjà beaucoup pour
 * une surface qui n'a aucune raison d'être connue.
 */
export async function verifyAdmin(): Promise<SessionInfo> {
  const session = await verifySession();
  if (!estAdmin(session.email)) {
    notFound();
  }
  return session;
}
