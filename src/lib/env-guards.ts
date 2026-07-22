// Relative import: this module is loaded from next.config.ts, whose loader
// does not resolve the "@/*" tsconfig alias.
import { env } from "./env";

/**
 * Cross-field production invariants. Kept OUT of env.ts module scope: these
 * read server-only variables, and env.ts is also evaluated in the browser
 * bundle (where t3-env throws on any server-var access). Called from
 * next.config.ts so violations fail the build.
 */
export function assertProductionEnvInvariants(): void {
  if (env.APP_ENV !== "production") {
    return;
  }
  if (env.INNGEST_DEV) {
    throw new Error(
      "INNGEST_DEV must not be set when APP_ENV=production: dev mode disables Inngest signature verification.",
    );
  }
  // Supabase is wired since J2: a production build without its configuration
  // must fail loudly instead of shipping an app whose auth silently breaks
  // (security-reviewer J1, carried criterion).
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !env.SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are required when APP_ENV=production.",
    );
  }
  // The Inngest serve handler exists since J4: without a signing key it would
  // accept unsigned requests, and without an event key sends would fail at
  // request time instead of build time (security-reviewer J1/J2, carried).
  if (!env.INNGEST_SIGNING_KEY || !env.INNGEST_EVENT_KEY) {
    throw new Error(
      "INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY are required when APP_ENV=production.",
    );
  }
}
