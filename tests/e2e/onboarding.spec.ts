import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e: first-login fluid onboarding. A brand-new user lands on the dashboard
// HERO (upload your CV), the chip flow confirms skills, and the dashboard
// then flips to its STATUS view — the "upload → results" loop, end to end.
// Dedicated synthetic user per run (clean empty state).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p5-onboarding-${randomUUID()}@test.local`;
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

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test("premier login : hero « upload CV » → ajout → écran de succès, puis vue statut au retour", async ({
  page,
}) => {
  await signIn(page);

  // A fresh profile lands on the CV hero, not a bare shell.
  await expect(
    page.getByRole("heading", { name: "Bienvenue sur MissionPilot" }),
  ).toBeVisible();
  await expect(page.getByText("Importer mon CV")).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  // Paste a CV, analyse, keep the detected skills, add them.
  await page
    .getByLabel("…ou collez le texte de votre CV")
    .fill("Ingénieur senior. Stack: TypeScript, React, PostgreSQL, Docker.");
  await page.getByRole("button", { name: "Analyser mon CV" }).click();
  await expect(
    page.getByText("Compétences détectées dans votre CV"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();

  // The flow stays on the CV import's own success screen (no mid-flow flip to
  // the status view — that showed a misleading "0 offers" window and lost
  // focus). Confirmation is announced in place; focus is not thrown to body.
  await expect(
    page.getByText(/compétences? confirmées? dans votre profil/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Votre tableau de bord" }),
  ).toHaveCount(0);

  // The status view is the destination on the NEXT visit, once the profile
  // genuinely exists.
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Votre tableau de bord" }),
  ).toBeVisible();
  await expect(page.getByText(/compétences? confirmées?/)).toBeVisible();
});
