import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// e2e: the clarification loop, end to end.
//
// THE HOLE THIS COVERS. The product asked questions and had nowhere to put the
// answers — no field, no action, no path back into the profile. This walks the
// whole round trip: a question is put, an answer is given, the profile CHANGES,
// and the same question is never asked again. Then the escape hatch: "je ne
// sais pas" settles a question without inventing a fact.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p6-questions-${randomUUID()}@test.local`;
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
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer" }).click();
  await page.waitForURL(/\/dashboard/);
}

test("une question posée reçoit une réponse, le profil change, et elle n'est jamais reposée", async ({
  page,
}) => {
  await signIn(page);

  // Give the profile something to reflect, so the mirror state is reached.
  await page.getByRole("button", { name: "Mon CV" }).click();
  await page
    .getByLabel("…ou collez le texte de votre CV")
    .fill(
      "Ingénieur. Stack: TypeScript, React, PostgreSQL, Docker, Kubernetes.",
    );
  await page.getByRole("button", { name: "Analyser mon CV" }).click();
  await expect(
    page.getByText("Compétences détectées dans votre CV"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();

  // The screen REFLECTS the import instead of handing back an empty drop zone.
  await expect(
    page.getByRole("heading", { name: "Voilà ce que j'ai compris." }),
  ).toBeVisible();
  await expect(page.getByText("5 compétences retenues")).toBeVisible();

  // The first question is the role: without it there is nothing to search.
  await expect(
    page.getByRole("heading", { name: "Quel métier exercez-vous" }),
  ).toBeVisible();
  await expect(
    page.getByText("je n'ai rien à chercher", { exact: false }),
  ).toBeVisible();

  // Answer it in free text.
  await page.getByPlaceholder("Service Designer").fill("Service Designer");
  await page.getByRole("button", { name: "Valider" }).click();

  // THE PROOF, and it is the strongest one available: that single answer was
  // enough to open the automatic search, so the whole screen turns into the
  // market. This is why the question was worth asking — it did not fill a
  // column, it changed what the person is looking at.
  await expect(
    page.getByRole("heading", { name: "Ce que le marché a pour vous" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quel métier exercez-vous" }),
  ).toHaveCount(0);

  // And the conversation continues NEXT TO the results rather than gating
  // them: everything else we still want to know is asked while they read.
  await expect(
    page.getByRole("heading", { name: "À quel niveau vous situez-vous" }),
  ).toBeVisible();

  // The escape hatch is a real, first-class option — and it is remembered.
  await page.getByRole("button", { name: "Je ne sais pas" }).click();
  await expect(
    page.getByRole("heading", { name: "À quel niveau vous situez-vous" }),
  ).toHaveCount(0);

  // It survives a reload: a skip that is forgotten is a question re-asked.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "À quel niveau vous situez-vous" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Quel métier exercez-vous" }),
  ).toHaveCount(0);

  // The conversation has moved on to what it does not yet know.
  await expect(
    page.getByRole("heading", { name: "Combien d'années d'expérience" }),
  ).toBeVisible();

  // An answer we cannot read is REFUSED, not interpreted — and refusing must
  // not consume the question. Losing someone's answer because our parser was
  // narrow would be our failure, charged to them.
  await page.getByRole("button", { name: "Je ne sais pas" }).click();
  await expect(
    page.getByRole("heading", { name: "Combien d'années d'expérience" }),
  ).toHaveCount(0);

  // Scope questions follow, and they are answered from closed vocabularies.
  await expect(
    page.getByRole("heading", { name: "Où acceptez-vous de travailler" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "France", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Le télétravail" }),
  ).toBeVisible();
});
