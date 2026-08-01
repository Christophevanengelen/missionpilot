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
  await page.getByRole("button", { name: "J’ai déjà un mot de passe" }).click();
  await page.getByLabel("Votre e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer" }).click();
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
  // ONE question, two answers — not four fields at once.
  await expect(
    page.getByRole("heading", { name: "Par quoi commence-t-on ?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mon profil LinkedIn" }),
  ).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  // Paste a CV, analyse, keep the detected skills, add them.
  await page.getByRole("button", { name: "Mon CV" }).click();
  await page
    .getByLabel("…ou collez le texte de votre CV")
    .fill("Ingénieur senior. Stack: TypeScript, React, PostgreSQL, Docker.");
  /* Le consentement de l'art. 9 est une porte réelle sur le chemin critique :
     sans lui, le CV n'est pas lu. Les parcours qui déposent un CV doivent donc
     le franchir comme une personne le ferait — le cocher ici n'est pas un
     contournement, c'est reproduire le geste. */
  await page.getByLabel(/j'accepte que missionpilot lise mon cv/i).check();
  await page.getByRole("button", { name: "Analyser mon CV" }).click();
  await expect(
    page.getByText("Compétences détectées dans votre CV"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();
  // The import either stays on its own confirmation or chains straight to the
  // next screen, depending on whether a discovery source is enabled — so wait
  // for EITHER outcome before navigating. Waiting for only one makes the test
  // pass or fail on an environment flag rather than on the product.
  await expect(
    page.getByText(
      /compétences? confirmées? dans votre profil|Voilà ce que j'ai compris/,
    ),
  ).toBeVisible();
  await page.goto("/dashboard");

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
  await expect(
    page.getByRole("heading", { name: "Par quoi commence-t-on ?" }),
  ).toHaveCount(0);
});
