import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
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
