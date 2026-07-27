import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { randomUUID } from "node:crypto";

// e2e: the LinkedIn OFFICIAL data-export path (never scraping). A synthetic
// export ZIP is uploaded, its CSVs become a career narrative, and the SAME
// chip flow runs — declared skills join the profile confirmed. Keyless env:
// deterministic detector + declared skills (no AI). Dedicated synthetic user.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p5-linkedin-${randomUUID()}@test.local`;
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

function exportZip(): Buffer {
  const files: Record<string, Uint8Array> = {
    "Profile.csv": strToU8(
      "Headline,Summary,Industry\n" +
        '"Senior Data Engineer","Pipelines à l\'échelle.","Software"\n',
    ),
    "Positions.csv": strToU8(
      "Company Name,Title,Description,Location,Started On,Finished On\n" +
        '"Nova","Data Engineer","Spark et Airflow","Paris","2020","2024"\n',
    ),
    "Skills.csv": strToU8("Name\nSpark\nGraphQL\n"),
  };
  return Buffer.from(zipSync(files));
}

test("import export LinkedIn : archive → narratif → compétences déclarées confirmées", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");
  await expect(page.getByText("importez votre export LinkedIn")).toBeVisible();

  await page.locator("#linkedin-file").setInputFiles({
    name: "linkedin-export.zip",
    mimeType: "application/zip",
    buffer: exportZip(),
  });
  await page
    .getByRole("button", { name: "Analyser mon export LinkedIn" })
    .click();

  // Keyless env → the deterministic chip flow, seeded with the DECLARED skills
  // from Skills.csv (surfaced even if the taxonomy does not know them). The
  // heading is LinkedIn-specific (not "…dans votre CV").
  await expect(
    page.getByText("Compétences détectées dans votre export LinkedIn"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "GraphQL", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Ajouter à mon profil" }).click();
  await expect(
    page.getByText(/compétences? confirmées? dans votre profil/),
  ).toBeVisible();
});

/**
 * Le chemin « Remplir avec LinkedIn ».
 *
 * Ce que ce test protège vraiment : l'ABSENCE du bouton quand rien n'est
 * configuré. Un bouton visible qui mène à une erreur de configuration se paie
 * sur le premier écran, là où ça coûte le plus — et c'est précisément ce qui
 * arrive si l'on oublie de conditionner l'affichage.
 *
 * Il vérifie aussi qu'aucun champ « jeton » ne subsiste. C'est le vestige d'une
 * erreur de conception : un outil de développeur exposé à un utilisateur. Il ne
 * doit pas revenir par inadvertance.
 */
test("sans configuration LinkedIn : pas de bouton, pas de champ jeton, et l'archive reste possible", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");

  await expect(page.getByLabel("Jeton d'accès LinkedIn")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Remplir avec LinkedIn" }),
  ).toHaveCount(0);

  // Le chemin qui marche pour tout le monde, lui, doit toujours être là.
  await expect(page.getByText("importez votre export LinkedIn")).toBeVisible();
});
