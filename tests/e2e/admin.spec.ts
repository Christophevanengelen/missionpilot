import { expect, test } from "@playwright/test";

/**
 * Le tableau de pilotage — qui y entre, et qui n'y entre pas.
 *
 * Ces trois cas sont la garde elle-même. Ils sont écrits parce qu'un panneau
 * d'administration qui s'ouvre trop largement ne le dit jamais : il rend une
 * page, et c'est tout.
 */

const EMAIL = process.env.DEV_USER_EMAIL ?? "";
const PASSE = process.env.DEV_USER_PASSWORD ?? "";

/**
 * L'utilisateur de développement doit être SUR la liste, sinon `verifyAdmin()`
 * lui rend un 404 — et les deux cas ci-dessous échouent parce que la garde
 * fonctionne, ce qui est la pire façon de lire un test rouge. Constaté en
 * intégration continue le 2026-08-01 : la variable n'y était pas déclarée.
 * Elle l'est maintenant ; ce garde-fou reste pour la machine d'à côté où elle
 * manquera encore.
 */
const SUR_LA_LISTE = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .includes(EMAIL.toLowerCase());

async function entrer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "J’ai déjà un mot de passe" }).click();
  await page.getByLabel("Votre e-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill(PASSE);
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("un anonyme est renvoyé vers la connexion, jamais vers un 404", async ({
  page,
}) => {
  // La distinction compte : le proxy intercepte AVANT la garde. Un anonyme ne
  // doit pas apprendre que la page existe, mais il doit pouvoir se connecter.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("l'adresse autorisée voit le pilotage, et il ne nomme personne", async ({
  page,
}) => {
  test.skip(
    EMAIL === "" || PASSE === "" || !SUR_LA_LISTE,
    "identifiants de dev absents, ou dev absent d'ADMIN_EMAILS",
  );
  await entrer(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Pilotage" })).toBeVisible();
  await expect(page.getByText("Recherche ouverte")).toBeVisible();

  // LA GARANTIE QUI COMPTE : des agrégats, jamais des individus. Aucune
  // adresse ne doit apparaître dans le pilotage — y compris celle de la
  // personne connectée, qui est pourtant à un `session.email` de distance.
  //
  // On vise le panneau, pas la page : l'en-tête de l'application affiche
  // légitimement l'adresse de qui est connecté. Viser `body` faisait échouer
  // une garantie pourtant tenue — un test faux est pire qu'un test absent,
  // parce qu'on finit par le désactiver et par perdre la garantie avec lui.
  const texte = (await page.getByTestId("pilotage").innerText()).toLowerCase();
  expect(texte).not.toContain(EMAIL.toLowerCase());
  expect(texte).not.toContain("@");
});

test("le parrainage est DÉCLARÉ inexistant, pas affiché à zéro", async ({
  page,
}) => {
  test.skip(
    EMAIL === "" || PASSE === "" || !SUR_LA_LISTE,
    "identifiants de dev absents, ou dev absent d'ADMIN_EMAILS",
  );
  await entrer(page);
  await page.goto("/admin");
  // Un zéro se lit comme un échec de traction ; « aucune mécanique » se lit
  // comme ce que c'est.
  await expect(page.getByText(/aucune mécanique de parrainage/i)).toBeVisible();
});
