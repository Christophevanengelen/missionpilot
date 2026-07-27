import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Les documents juridiques, vérifiés là où ils comptent.
 *
 * Trois choses, dont deux qu'aucune relecture ne garantit :
 *
 * 1. Ils sont PUBLICS. Une politique de confidentialité derrière une connexion
 *    ne remplit pas l'art. 12(1) — on doit pouvoir lire ce qu'un service fera
 *    de ses données AVANT de lui en confier. LinkedIn vérifie d'ailleurs cette
 *    accessibilité pour accorder l'accès à son API.
 *
 * 2. Ils ne débordent pas latéralement. Ce document cite des URL longues et
 *    contient neuf tableaux ; sans contrainte, la page entière défile de côté
 *    sur un téléphone, et un document qu'on lit de travers est un document
 *    qu'on ne lit pas.
 *
 * 3. Il ne reste aucun marqueur de rédaction. Des crochets dans un texte publié
 *    ressemblent à un brouillon qui a fuité — et, pire, à une promesse qu'on
 *    n'a pas tenue.
 */

const PAGES = [
  {
    url: "/confidentialite",
    titre: "MissionPilot — Politique de confidentialité",
  },
  {
    url: "/conditions",
    titre: "MissionPilot — Conditions générales d’utilisation",
  },
];

for (const page_ of PAGES) {
  test(`${page_.url} est lisible sans compte`, async ({ page }) => {
    // Aucune connexion préalable : c'est tout l'objet du test.
    await page.goto(page_.url);
    await expect(page).toHaveURL(new RegExp(`${page_.url}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test(`${page_.url} ne contient aucun marqueur de rédaction`, async ({
    page,
  }) => {
    await page.goto(page_.url);
    const texte = (await page.locator("main").innerText()).toLowerCase();
    expect(texte).not.toContain("⟦");
    expect(texte).not.toContain("à compléter");
    expect(texte).not.toContain("à confirmer avant publication");
    // Et l'adresse annoncée est bien celle du service.
    expect(texte).not.toContain("missionpilot.vercel.app/confidentialite");
  });

  test(`${page_.url} ne déborde pas à 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(page_.url);
    const debordement = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(debordement).toBe(false);
  });

  test(`${page_.url} est accessible`, async ({ page }) => {
    await page.goto(page_.url);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  });
}

test("la landing y mène avant toute inscription", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Politique de confidentialité" })
    .click();
  await expect(page).toHaveURL(/\/confidentialite$/);
});
