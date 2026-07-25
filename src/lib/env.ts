import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment access. Imported by next.config.ts so a missing or
 * malformed variable fails the build, not a request at runtime.
 *
 * Supabase and Inngest variables become required when those services are
 * wired in (milestones J2/J4); until then they are optional so the scaffold
 * builds without secrets. AI provider keys stay optional for the whole of
 * Phase 0 (mock provider only).
 */
export const env = createEnv({
  server: {
    APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),
    // Dev mode disables Inngest signature verification — it must never reach
    // production (security-reviewer J1). Enforced below via APP_ENV.
    INNGEST_DEV: z.string().optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    AI_DEFAULT_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    AI_DEFAULT_MODEL: z.string().default("mock-v1"),
    // Adzuna job-search API (official, ToS-permissive) — optional: without
    // both, discovery degrades gracefully to an explanatory note.
    ADZUNA_APP_ID: z.string().min(1).optional(),
    ADZUNA_APP_KEY: z.string().min(1).optional(),
    /** Adzuna country market to search (two-letter site code). */
    ADZUNA_COUNTRY: z
      .string()
      .regex(/^[a-z]{2}$/)
      .default("fr"),
    // France Travail official "Offres d'emploi v2" API (OAuth2 client-
    // credentials) — optional second legal discovery source; without both,
    // it is simply inert (same graceful degradation as Adzuna).
    FRANCE_TRAVAIL_CLIENT_ID: z.string().min(1).optional(),
    FRANCE_TRAVAIL_CLIENT_SECRET: z.string().min(1).optional(),
    // Remotive remote/freelance feed — opt-in so the deployment explicitly
    // accepts its attribution + polling terms (no key needed, public API).
    REMOTIVE_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    // Himalayas and Jobicy — public, documented, key-less APIs. Opt-in for the
    // same reason as Remotive: both REQUIRE visible attribution with a link
    // back, so a deployment must accept those terms deliberately rather than
    // inherit them by merely deploying.
    HIMALAYAS_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    JOBICY_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    CRON_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  },
  // NEXT_PUBLIC_* values are inlined at build time and must be listed one by one.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

// Cross-field production invariants live in src/lib/env-guards.ts (called
// from next.config.ts): they read server-only vars and must never execute in
// the browser bundle, where this module is also evaluated.
