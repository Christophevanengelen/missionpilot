import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e: first login. A brand-new user lands on the drop zone, pastes a CV, and
// the next screen REFLECTS what was read instead of asking for a CV again.
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

test("premier login : dépôt du CV → l'écran RESTITUE ce qu'il a compris, il ne redemande pas un CV", async ({
  page,
}) => {
  await signIn(page);

  // A fresh profile lands on the drop zone, and on nothing else.
  await expect(
    page.getByRole("heading", { name: "Déposez votre CV" }),
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

  // THE REGRESSION THIS TEST EXISTS FOR: the profile is still too thin to
  // search on (no role, no seniority), and the old screen answered that by
  // showing the drop zone again — the same empty box the user had just filled.
  // It must reflect what it read and ask for exactly one more thing.
  await expect(
    page.getByRole("heading", { name: "Voilà ce que j'ai compris." }),
  ).toBeVisible();
  await expect(
    page.getByText("Votre parcours, tel que je l'ai lu"),
  ).toBeVisible();
  await expect(page.getByText("TypeScript", { exact: true })).toBeVisible();

  // The gaps stay visible rather than being quietly dropped.
  await expect(page.getByText("votre CV ne le dit pas").first()).toBeVisible();

  // And the drop zone is gone: asking again for what was already given is the
  // failure mode, not a fallback.
  await expect(page.getByText("Importer mon CV")).toHaveCount(0);
});
