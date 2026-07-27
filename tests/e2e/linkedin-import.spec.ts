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
  await page.getByLabel("Email").fill(email);
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
 * L'import automatique par l'API de portabilité. Il n'est pas exercé de bout en
 * bout ici : cela demanderait un vrai jeton LinkedIn, c'est-à-dire un secret
 * dans le dépôt. Ce qui EST vérifié est ce qui peut l'être sans secret, et qui
 * est exactement ce qui protège la personne — le champ masque la saisie, et
 * l'écran énonce que le jeton n'est pas conservé.
 */
test("import par l’API LinkedIn : le jeton est masqué et sa non-conservation est écrite", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");

  const champ = page.getByLabel("Jeton d'accès LinkedIn");
  await expect(champ).toBeVisible();
  // Un jeton en clair finit dans une capture d'écran ou dans le dos de
  // quelqu'un ; le masquage n'est pas cosmétique.
  await expect(champ).toHaveAttribute("type", "password");
  // Et il ne doit jamais être proposé au remplissage automatique du navigateur.
  await expect(champ).toHaveAttribute("autocomplete", "off");

  await expect(
    page.getByText(/n'est ni enregistré ni journalisé/i),
  ).toBeVisible();

  // Sans jeton, l'écran demande, il n'appelle pas LinkedIn.
  await page.getByRole("button", { name: "Importer depuis LinkedIn" }).click();
  // Filtré sur le contenu : Next rend son propre annonceur de route avec
  // `role="alert"`, toujours vide. Viser le rôle seul rend l'assertion
  // ambiguë — et une assertion ambiguë échoue pour la mauvaise raison.
  await expect(
    page.getByRole("alert").filter({ hasText: "Collez le jeton" }),
  ).toBeVisible();
});
