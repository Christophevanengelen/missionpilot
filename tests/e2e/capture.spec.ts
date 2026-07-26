import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Screenshot capture of the product's actual screens, in order.
 *
 * Not a gate — it asserts almost nothing. It exists so the owner can SEE the
 * built product without signing in, using a synthetic local account and the
 * real code path. Run explicitly:
 *
 *   pnpm exec playwright test tests/e2e/capture.spec.ts
 *
 * It is excluded from the CI e2e run by its `@capture` tag.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const OUT = process.env.CAPTURE_DIR ?? "capture";

const email = `capture-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

test.beforeAll(async () => {
  test.skip(!secretKey, "SUPABASE_SECRET_KEY not configured");
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  userId = created.data.user.id;
});

test.afterAll(async () => {
  if (!userId) return;
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(userId);
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test("@capture le parcours complet, en images", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  // 1 — Nothing at all: one sentence, one drop zone.
  await expect(
    page.getByRole("heading", { name: "Déposez votre CV" }),
  ).toBeVisible();
  await shot(page, "1-depot");

  // 2 — The mirror: what we understood, gaps included, then ONE question.
  await page
    .getByLabel("…ou collez le texte de votre CV")
    .fill(
      "Ingénieur. Stack: TypeScript, React, PostgreSQL, Docker, Kubernetes, Terraform.",
    );
  await page.getByRole("button", { name: "Analyser mon CV" }).click();
  await expect(
    page.getByText("Compétences détectées dans votre CV"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();
  await expect(
    page.getByText(/compétences? confirmées? dans votre profil/),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Voilà ce que j'ai compris." }),
  ).toBeVisible();
  await shot(page, "2-miroir-et-question");

  // 3 — One answer opens the search; the conversation continues beside it.
  await page.getByPlaceholder("Service Designer").fill("Service Designer");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(
    page.getByRole("heading", { name: "Ce que le marché a pour vous" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await shot(page, "3-le-marche-et-la-question-suivante");

  // 4 — The profile as a plan of work.
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Ce que votre profil vous ouvre" }),
  ).toBeVisible();
  await shot(page, "4-progression-et-conseils");
});
