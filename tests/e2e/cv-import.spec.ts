import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e: paste CV text → deterministic skill detection → chosen skills join the
// profile as proposals (visible in the interview panel). Dedicated synthetic
// user per run.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p4-cv-e2e-${randomUUID()}@test.local`;
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

test("import de CV : texte collé → compétences détectées → ajout au profil", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");
  await expect(page.getByText("Importer mon CV")).toBeVisible();

  // Paste a CV excerpt and analyse it.
  await page
    .getByLabel("…ou collez le texte de votre CV")
    .fill(
      "Ingénieur senior. Stack: TypeScript, React, Node.js, PostgreSQL, Docker.",
    );
  await page.getByRole("button", { name: "Analyser mon CV" }).click();

  // Detected skills appear as toggle chips, all selected by default.
  await expect(
    page.getByText("Compétences détectées dans votre CV"),
  ).toBeVisible();
  for (const skill of [
    "TypeScript",
    "React",
    "Node.js",
    "PostgreSQL",
    "Docker",
  ]) {
    await expect(
      page.getByRole("button", { name: skill, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }

  // Unselect one, add the rest.
  await page.getByRole("button", { name: "Docker", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Docker", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();
  await expect(page.getByRole("status")).toContainText(
    "4 compétences ajoutées",
  );

  // Discovery auto-chains after the validation (no button). Keyless CI: the
  // honest outcome is the specific "not configured" explanation.
  await expect(page.getByRole("status")).toContainText(
    "La découverte automatique n'est pas encore activée",
  );

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
