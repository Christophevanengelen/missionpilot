import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/db/config";
import type { Database } from "@/lib/db/database.types";

/** Supabase client for Client Components (browser). Publishable key only. */
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
