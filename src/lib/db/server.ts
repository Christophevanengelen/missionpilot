import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/db/config";
import type { Database } from "@/lib/db/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Created per request — never cache or share it across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which cannot write cookies.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
