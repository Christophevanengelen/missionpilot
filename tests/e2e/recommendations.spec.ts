import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e: add a received recommendation → it becomes a testimonial with a
// CLICKABLE verification link (peer proof the user can trace back). Dedicated
// synthetic user per run.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p4-rec-e2e-${randomUUID()}@test.local`;
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

test("ajouter une recommandation reçue → preuve avec lien de vérification cliquable", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile/recommendations");
  await expect(
    page.getByRole("heading", { name: "Recommandations reçues" }),
  ).toBeVisible();
  // Only the most-specific nav item is current — not both /profile and the
  // nested /profile/recommendations.
  await expect(
    page.locator('nav[aria-label="Primary"] a[aria-current="page"]'),
  ).toHaveCount(1);
  await expect(page.getByText("Aucune recommandation")).toBeVisible();

  await page.getByLabel("Qui vous recommande").fill("Jane Doe");
  await page
    .getByLabel("Lien de vérification (recommandé)")
    .fill("https://www.linkedin.com/in/janedoe/");
  await page
    .getByLabel("Texte de la recommandation")
    .fill(
      "Excellent ingénieur senior — a livré la migration de la plateforme.",
    );
  await page.getByRole("button", { name: "Ajouter la recommandation" }).click();

  // The recommendation is listed, with a clickable verification link.
  const item = page.getByRole("article").filter({ hasText: "Jane Doe" });
  await expect(item).toHaveCount(1);
  await expect(
    item.getByText("Excellent ingénieur senior", { exact: false }),
  ).toBeVisible();
  const verify = item.getByRole("link", { name: "Vérifier la source" });
  await expect(verify).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/janedoe/",
  );
  await expect(verify).toHaveAttribute("rel", /noopener/);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
