import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Critical e2e for Phase 2 opportunity ingestion. Dedicated synthetic user
// per run (admin API), cleaned up in afterAll. Proves: paste → import →
// inspection (normalized data + unverified banner + frozen source) →
// list → dedup on re-import.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p2-e2e-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

const LISTING = [
  "Senior Platform Engineer",
  "chez Initech",
  "",
  "Location: Lyon, France",
  "Hybrid",
  "",
  "TJM: 650 €/jour",
  "",
  "Skills:",
  "- Kubernetes",
  "- Terraform",
].join("\n");

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

test("import d'une annonce collée : normalisation, bannière non vérifiée, source figée, dédup", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/opportunities");
  await expect(
    page.getByRole("heading", { name: "Opportunités" }),
  ).toBeVisible();

  // Paste + import.
  await page.getByLabel("Coller le texte d'une annonce").fill(LISTING);
  await page.getByRole("button", { name: "Importer l'annonce" }).click();

  // Lands on the inspection screen for the new opportunity.
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Senior Platform Engineer" }),
  ).toBeVisible();
  // Honesty: the unverified banner is present.
  await expect(page.getByText("non vérifiées", { exact: false })).toBeVisible();
  // Normalized fields extracted from the source (scoped to the normalized
  // section — the same words also appear in the frozen source capture).
  const normalized = page.getByRole("region", {
    name: "Données normalisées",
  });
  await expect(normalized.getByText("Initech", { exact: true })).toBeVisible();
  await expect(normalized.getByText("Hybride")).toBeVisible();
  await expect(normalized.getByText("Kubernetes")).toBeVisible();
  // The frozen source capture shows the exact pasted text.
  const source = page.getByRole("region", { name: /Capture source/ });
  await expect(source.getByText("TJM: 650 €/jour")).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  // The list shows exactly one opportunity.
  await page.getByRole("link", { name: "Retour aux opportunités" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(
    page.getByRole("article").filter({ hasText: "Senior Platform Engineer" }),
  ).toHaveCount(1);

  // Re-importing the same listing dedupes: still exactly one in the list.
  await page.getByLabel("Coller le texte d'une annonce").fill(LISTING);
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Retour aux opportunités" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Senior Platform Engineer" }),
  ).toHaveCount(1);
});
