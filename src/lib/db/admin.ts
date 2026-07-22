import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

/**
 * RLS-BYPASSING Supabase client, authenticated with the secret key.
 *
 * Confinement rules (SECURITY_AND_COMPLIANCE.md, ARCHITECTURE.md §9):
 * - importable only from server code (`server-only` guard above);
 * - reserved for trusted contexts: Inngest functions and admin routines;
 * - every write through this client must perform its own explicit ownership
 *   check (event payload user_id ↔ touched rows), because RLS will not.
 */
export function createServiceClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY (server-only) and NEXT_PUBLIC_SUPABASE_URL must be set to use the service client.",
    );
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
