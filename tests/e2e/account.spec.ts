import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * L'écran des données, de bout en bout.
 *
 * Ce que ces tests prouvent et qu'aucun test unitaire ne peut prouver : que la
 * suppression EFFACE RÉELLEMENT le compte côté serveur. Le reste — les textes,
 * les états — se vérifie ailleurs ; ceci se vérifie ici, en relisant l'API
 * admin après le clic.
 *
 * Utilisateur synthétique dédié par exécution. Celui du dernier test est
 * supprimé PAR le produit : c'est précisément l'objet du test.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

function admin() {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function creerUtilisateur() {
  const email = `compte-e2e-${randomUUID()}@test.local`;
  const password = `synthetic-${randomUUID()}`;
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  return { email, password, userId: created.data.user.id };
}

async function seConnecter(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "J’ai déjà un mot de passe" }).click();
  await page.getByLabel("Votre e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.beforeEach(() => {
  test.skip(!secretKey, "SUPABASE_SECRET_KEY not configured");
});

test("la page des données est accessible et n'ouvre pas le panneau toute seule", async ({
  page,
}) => {
  const u = await creerUtilisateur();
  try {
    await seConnecter(page, u.email, u.password);

    // Trouvable sans le chercher : un droit qu'on n'expose pas est théorique.
    await page.getByRole("link", { name: "Mon compte" }).click();
    await page.waitForURL(/\/compte/);

    await expect(
      page.getByRole("heading", { name: "Vos données et votre compte" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Télécharger mes données (JSON)" }),
    ).toBeVisible();

    // Le bouton destructeur n'existe PAS avant l'ouverture du panneau.
    await expect(
      page.getByRole("button", { name: "Supprimer définitivement mon compte" }),
    ).toHaveCount(0);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  } finally {
    await admin().auth.admin.deleteUser(u.userId);
  }
});

test("l'export produit un fichier nommé et téléchargeable", async ({
  page,
}) => {
  const u = await creerUtilisateur();
  try {
    await seConnecter(page, u.email, u.password);
    await page.goto("/compte");

    await page
      .getByRole("button", { name: "Télécharger mes données (JSON)" })
      .click();

    // On n'affirme jamais « le téléchargement a démarré » : on annonce un
    // fichier prêt et on rend un vrai lien. C'est cette promesse-là qu'on teste.
    const lien = page.getByRole("link", { name: "Enregistrer le fichier" });
    await expect(lien).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(
        /Fichier prêt : missionpilot-donnees-\d{4}-\d{2}-\d{2}\.json/,
      ),
    ).toBeVisible();
    await expect(lien).toHaveAttribute(
      "download",
      /missionpilot-donnees-.*\.json/,
    );
  } finally {
    await admin().auth.admin.deleteUser(u.userId);
  }
});

test("« Annuler » ferme le panneau sans rien supprimer", async ({ page }) => {
  const u = await creerUtilisateur();
  try {
    await seConnecter(page, u.email, u.password);
    await page.goto("/compte");

    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Supprimer définitivement votre compte",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Supprimer définitivement mon compte" }),
    ).toHaveCount(0);

    // Et le compte est toujours là — « fermer ce panneau ne supprime rien »
    // doit être vrai, pas seulement écrit.
    const { data } = await admin().auth.admin.getUserById(u.userId);
    expect(data.user?.id).toBe(u.userId);
  } finally {
    await admin().auth.admin.deleteUser(u.userId);
  }
});

test("la suppression efface RÉELLEMENT le compte, et mène à /au-revoir", async ({
  page,
}) => {
  const u = await creerUtilisateur();

  await seConnecter(page, u.email, u.password);
  await page.goto("/compte");

  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  await page
    .getByRole("button", { name: "Supprimer définitivement mon compte" })
    .click();

  await page.waitForURL(/\/au-revoir/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Votre compte a été supprimé." }),
  ).toBeVisible();

  // LA vérification qui compte : on relit côté serveur. Un écran de
  // confirmation est facile à afficher sur un mensonge.
  const { data } = await admin().auth.admin.getUserById(u.userId);
  expect(data.user).toBeNull();
});

test("/au-revoir sans témoin n'affirme aucune suppression", async ({
  page,
}) => {
  // Elle ne sait pas qui vous êtes — c'est voulu — donc elle ne peut rien
  // confirmer. Une page qui affirmerait quand même serait un bandeau
  // falsifiable par n'importe qui.
  await page.goto("/au-revoir");
  await expect(
    page.getByRole("heading", { name: "Suppression de compte" }),
  ).toBeVisible();
  await expect(page.getByText("Votre compte a été supprimé.")).toHaveCount(0);
});

test("le CV n'est pas lu tant que la case de consentement n'est pas cochée", async ({
  page,
}) => {
  const u = await creerUtilisateur();
  try {
    await seConnecter(page, u.email, u.password);
    await page.goto("/profile");

    // Coller un CV sans cocher : le refus doit venir AVANT tout envoi.
    await page
      .getByLabel("…ou collez le texte de votre CV")
      .fill("Service Designer, 11 ans d'expérience. Refonte pilotée.");
    await page.getByRole("button", { name: "Analyser mon CV" }).click();

    await expect(page.getByText(/Cochez la case ci-dessus/)).toBeVisible();
    // Ce n'est pas une panne : le message ne doit pas inviter à réessayer.
    await expect(page.getByText(/Réessayez/)).toHaveCount(0);

    // Et la page de compte confirme qu'aucun accord n'a été donné.
    await page.goto("/compte");
    await expect(
      page.getByText(/Vous n’avez pas donné cet accord/),
    ).toBeVisible();
  } finally {
    await admin().auth.admin.deleteUser(u.userId);
  }
});
