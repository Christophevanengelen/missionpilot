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
    // Recruitee — public, key-less, per-tenant careers API. Opt-in like the
    // others, and for one extra reason: it is the only source where WE choose
    // which employers are queried, from a list versioned in the repo. That is
    // a decision a deployment should take on purpose.
    RECRUITEE_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    // Remote OK — public, key-less feed. Opt-in like the others, and here for
    // one specific obligation: their terms make a FOLLOWED link back and a
    // named mention a condition of continued access.
    REMOTEOK_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /**
     * « Remplir avec LinkedIn » — le vrai bouton, par le flux OAuth de
     * Member Data Portability (3rd Party).
     *
     * Les trois valeurs vont ensemble : sans elles le bouton n'apparaît pas du
     * tout, et l'onboarding ne propose que le dépôt d'archive. Un bouton visible
     * qui mène à une erreur de configuration serait pire que pas de bouton —
     * il perdrait la personne au premier écran, là où ça coûte le plus.
     *
     * Le SECRET ne sort jamais du serveur : il ne sert qu'à l'échange
     * code → jeton, côté serveur, dans le gestionnaire de retour.
     */
    LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
    LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
    LINKEDIN_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    CRON_SECRET: z.string().min(1).optional(),
    /**
     * La connexion en un clic — Google et LinkedIn, chacune derrière son
     * interrupteur, DORMANTES par défaut. Même motif que LinkedIn (import) et
     * que le digest : le code part en production éteint, et l'allumage est un
     * geste distinct, réversible, qui ne demande pas de déploiement de code.
     *
     * Ces booléens ne remplacent pas la configuration côté Supabase (client
     * OAuth + secret, saisis dans SON tableau de bord, jamais ici) : ils
     * décident seulement si le BOUTON existe. Un bouton visible avant que le
     * fournisseur soit configuré mènerait à une erreur au premier écran — le
     * même piège que le bouton LinkedIn avant l'accord.
     */
    AUTH_GOOGLE_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    AUTH_LINKEDIN_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /**
     * Le digest hebdomadaire — et il part DORMANT, comme LinkedIn avant lui.
     *
     * Trois variables, trois rôles distincts, et la séparation est ce qui rend
     * la mise en service sûre :
     *
     * - `RESEND_API_KEY` : la clé d'envoi. Le SMTP existant est configuré côté
     *   Supabase, pour les liens magiques uniquement — l'application, elle,
     *   n'a jamais su envoyer un e-mail. C'est ce que cette clé ouvre.
     * - `DIGEST_FROM` : l'expéditeur. Explicite, jamais deviné : une adresse
     *   fausse fait tomber la délivrabilité du domaine entier, y compris les
     *   liens de connexion, qui eux fonctionnent aujourd'hui.
     * - `DIGEST_ENABLED` : l'interrupteur. Tant qu'il est faux, la tâche
     *   planifiée s'arrête à sa première ligne et n'écrit à personne.
     *
     * Pourquoi un interrupteur en plus de la clé : poser une clé est une
     * action de configuration, allumer un envoi automatique vers de vraies
     * boîtes aux lettres en est une autre. Les confondre, c'est risquer un
     * premier envoi le jour où l'on voulait seulement préparer le terrain.
     */
    RESEND_API_KEY: z.string().min(1).optional(),
    DIGEST_FROM: z.string().email().optional(),
    DIGEST_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
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
