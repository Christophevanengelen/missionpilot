/**
 * Creates the local development user via the Supabase admin API.
 *
 * - Idempotent: a second run detects the existing account and exits 0.
 * - Local-only guard: refuses to run against a non-local Supabase URL.
 * - Never INSERTs into auth.users directly (unsupported schema).
 *
 * Usage: pnpm exec tsx scripts/create-dev-user.ts  (requires `supabase start`)
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local may be absent in CI where variables come from the environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEV_USER_EMAIL ?? "dev@missionpilot.local";
const password = process.env.DEV_USER_PASSWORD;

if (!url || !secretKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (run `supabase start`, copy values into .env.local).",
  );
  process.exit(1);
}
if (!password) {
  console.error("DEV_USER_PASSWORD is required (set it in .env.local).");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(
    `Refusing to create a dev user against non-local Supabase URL: ${url}`,
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const admin = createClient(url!, secretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const alreadyExists =
      error.code === "email_exists" ||
      /already.*(registered|exists)/i.test(error.message);
    if (alreadyExists) {
      console.log(
        `Dev user ${email} already exists — nothing to do (idempotent).`,
      );
      return;
    }
    console.error(`Failed to create dev user: ${error.code ?? error.message}`);
    process.exit(1);
  }

  console.log(`Dev user created: ${data.user?.email} (${data.user?.id})`);
}

void main();
