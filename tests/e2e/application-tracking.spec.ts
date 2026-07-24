import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e for Phase 6 P8 application tracking: paste-import an offer → open it →
// set the pipeline stage + a note → the offer appears in the /applications
// board under that stage. Deterministic (no AI), so it runs in keyless CI.
// Dedicated synthetic user per run.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p8-track-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

const LISTING = [
  "Staff Backend Engineer",
  "chez Globex",
  "",
  "Go, Postgres.",
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

test("suivi : import → étape « Postulée » → apparaît dans le pipeline", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/opportunities");
  await page.getByLabel("Coller le texte d'une annonce").fill(LISTING);
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  await page.getByRole("link", { name: "Voir l'opportunité" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);

  // Track it: move to "Postulée" with a note, save.
  const panel = page.getByRole("region", { name: "Suivi de candidature" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Étape").selectOption("applied");
  await panel.getByLabel("Note").fill("Candidature envoyée le 24/07");
  await panel.getByRole("button", { name: "Enregistrer le suivi" }).click();
  await expect(
    panel.getByRole("button", { name: "Retirer du suivi" }),
  ).toBeVisible();

  // The board shows it in the Applied column.
  await page.getByRole("link", { name: "Applications", exact: true }).click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(
    page.getByRole("heading", { name: "Suivi des candidatures" }),
  ).toBeVisible();
  const applied = page.getByRole("region", { name: "Postulée" });
  await expect(applied.getByText("Staff Backend Engineer")).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
