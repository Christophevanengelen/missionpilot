import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Critical e2e for target preferences & hard constraints (PR E). Dedicated
// synthetic user per run (admin API), cleaned up in afterAll. Proves the
// full loop: edit → save → reload persists (server is the source of truth),
// and an incoherent rate floor is refused with an honest message.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p1e-e2e-${randomUUID()}@test.local`;
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

async function signInAndOpen(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/profile/preferences");
}

test("préférences : éditer → enregistrer → persister au rechargement, plancher incohérent refusé", async ({
  page,
}) => {
  await signInAndOpen(page);
  await expect(
    page.getByRole("heading", { name: "Préférences & contraintes" }),
  ).toBeVisible();

  // Fill a representative set.
  await page
    .getByLabel("Familles de rôles visées")
    .fill("Design produit, Design systems");
  await page.getByRole("button", { name: "Freelance", exact: true }).click();
  await page.getByLabel("TJM visé").fill("800");
  await page.getByLabel("TJM plancher").fill("650");
  await page.getByLabel("Devise").selectOption("EUR");
  await page
    .getByLabel("Politique de télétravail")
    .selectOption("remote_first");
  await page.getByLabel("Exclusions absolues").fill("Défense, Jeux d'argent");

  // Axe scan on the populated form.
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  await page
    .getByRole("button", { name: "Enregistrer les préférences" })
    .click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

  // Reload: values come purely from the database.
  await page.reload();
  await expect(page.getByLabel("TJM visé")).toHaveValue("800");
  await expect(page.getByLabel("TJM plancher")).toHaveValue("650");
  await expect(page.getByLabel("Devise")).toHaveValue("EUR");
  await expect(page.getByLabel("Politique de télétravail")).toHaveValue(
    "remote_first",
  );
  await expect(
    page.getByRole("button", { name: "Freelance", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // An incoherent floor (minimum above target) is refused honestly and
  // never silently saved.
  await page.getByLabel("TJM plancher").fill("2000");
  await page
    .getByRole("button", { name: "Enregistrer les préférences" })
    .click();
  await expect(
    page.getByText("Les préférences n'ont pas pu être enregistrées", {
      exact: false,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("TJM plancher")).toHaveValue("650");
});
