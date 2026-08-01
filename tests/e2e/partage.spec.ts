import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lienReseau } from "../../src/lib/partage/liens";

/**
 * Le partage, vu du navigateur.
 *
 * Le test qui compte n'est pas « le bouton existe » : c'est que le panneau
 * ouvert ne contienne RIEN de la personne. Sur un produit de recherche
 * d'emploi, un partage qui laisserait filtrer ce que quelqu'un regarde n'est
 * pas une fuite de données, c'est un risque de licenciement.
 */

/** Ouvre le panneau et rend son périmètre — c'est LUI qu'on inspecte, pas la
 *  page : la page d'accueil dit légitimement « Déposez votre CV », et viser
 *  `main` ferait échouer le test sur sa propre promesse. */
async function ouvrirPartage(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Partager MissionPilot" }).click();
  return page.getByTestId("partage");
}

test("la page publique propose de partager l'outil, et le panneau s'ouvre au clavier", async ({
  page,
}) => {
  await page.goto("/");
  const bouton = page.getByRole("button", { name: "Partager MissionPilot" });
  await expect(bouton).toBeVisible();
  await expect(bouton).toHaveAttribute("aria-expanded", "false");

  // Au clavier, pas seulement à la souris : c'est le même geste pour tout le
  // monde ou ce n'est pas une fonctionnalité.
  await bouton.focus();
  await page.keyboard.press("Enter");
  await expect(bouton).toHaveAttribute("aria-expanded", "true");

  await expect(
    page.getByRole("button", { name: "Copier le lien" }),
  ).toBeVisible();
  for (const reseau of ["LinkedIn", "Bluesky", "X", "E-mail"]) {
    await expect(page.getByRole("link", { name: reseau })).toBeVisible();
  }
});

test("chaque lien de partage porte l'adresse publique, et aucun paramètre de suivi", async ({
  page,
}) => {
  const panneau = await ouvrirPartage(page);
  // L'origine attendue est celle de la page servie, pas un domaine écrit en
  // dur : en intégration continue c'est `localhost:3000`, et un test qui
  // exigerait « missionpilot » ne vérifierait que l'environnement.
  const origine = new URL(page.url()).origin;

  const liens = await panneau
    .locator("a")
    .evaluateAll((n) => n.map((a) => (a as HTMLAnchorElement).href));
  expect(liens.length).toBe(4);
  for (const href of liens) {
    const decode = decodeURIComponent(href);
    expect(decode).toContain(origine);
    // Ni identifiant de parrainage, ni traceur de campagne.
    expect(decode).not.toMatch(/[?&](utm_|via=|ref=|fbclid=)/);
  }
});

test("le panneau de partage ne nomme ni la personne ni ce qu'elle regarde", async ({
  page,
}) => {
  const panneau = await ouvrirPartage(page);
  const origine = new URL(page.url()).origin;

  /**
   * L'ASSERTION EST UNE ÉGALITÉ, PAS UNE LISTE DE MOTS INTERDITS.
   *
   * Première version : interdire « cv », « profil », « offre ». Elle échouait
   * — sur la promesse du panneau lui-même, qui dit « rien de votre parcours ni
   * des offres que vous regardez ne quitte cette page ». Un mot n'est pas une
   * fuite ; ce qui compte est d'où vient la valeur.
   *
   * Donc : chaque lien doit être EXACTEMENT ce que `liens.ts` produit à partir
   * de la seule adresse publique. Le panneau est une fonction pure de cette
   * URL — si quoi que ce soit de la personne s'y glissait un jour, l'égalité
   * casserait, quel que soit le vocabulaire employé.
   */
  /* On compare les formes DÉCODÉES : le navigateur normalise l'encodage en
     lisant `.href` — il rend l'apostrophe `%27` là où `encodeURIComponent` la
     laisse telle quelle. Comparer les chaînes brutes ferait échouer le test
     sur une différence de typographie, pas de contenu. */
  const decode = (u: string) => decodeURIComponent(u);
  const attendus = (["linkedin", "bluesky", "x", "email"] as const).map((r) =>
    decode(lienReseau(r, origine)),
  );
  const obtenus = await panneau
    .locator("a")
    .evaluateAll((n) => n.map((a) => (a as HTMLAnchorElement).href));
  expect(obtenus.map(decode)).toEqual(attendus);

  // Aucun destinataire pré-rempli : `mailto:?subject=` n'en a pas, et c'est la
  // forme voulue — la personne choisit le sien.
  expect(obtenus.map(decode).join(" ")).not.toMatch(/mailto:[\w.+-]+@/);

  // La promesse est écrite à l'écran, pas seulement tenue dans le code.
  await expect(panneau.getByText(/jamais votre recherche/i)).toBeVisible();
});

test("le partage n'introduit aucune régression d'accessibilité, ouvert compris", async ({
  page,
}) => {
  // Mouvement réduit AVANT le chargement, pour la raison écrite dans
  // `landing.spec.ts` : la page entre en fondu, et axe mesurerait les
  // couleurs à mi-transition — l'opacité partielle mélange le texte au fond
  // et fait chuter le ratio pour de mauvaises raisons.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ouvrirPartage(page);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations,
    `violations axe : ${JSON.stringify(
      axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    )}`,
  ).toEqual([]);
});
