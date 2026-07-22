import { env } from "@/lib/env";

/**
 * Supabase connection values. Optional in the env schema (CI builds without a
 * local stack must succeed), so every consumer goes through this accessor and
 * fails loudly with an actionable message instead of reaching Supabase with
 * `undefined`.
 */
export function getSupabaseConfig() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set (run `supabase start` and copy them into .env.local).",
    );
  }
  return { url, publishableKey };
}
