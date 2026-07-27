import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * La page publique. Aucun compte requis — c'est justement son sujet.
 *
 * Ce fichier existe pour une raison précise : la landing introduit un plan de
 * couleur qui n'existe nulle part ailleurs dans le produit — une encre profonde
 * conservée dans les DEUX thèmes, et un doré qui n'est pas un jeton applicatif.
 * Les contrastes de ce plan ne sont donc couverts par aucun autre test, et un
 * contraste se vérifie, il ne se suppose pas.
 */

test.describe("page publique", () => {
  test("axe propre en clair ET en sombre, y compris le plan encre", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /monter d’une marche/i }),
    ).toBeVisible();

    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => {
        document.documentElement.classList.toggle("dark", t === "dark");
      }, theme);
      const resultats = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        resultats.violations,
        `violations axe en thème ${theme}: ${JSON.stringify(
          resultats.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.length,
          })),
        )}`,
      ).toEqual([]);
    }
  });

  test("les deux refus sont énoncés avant tout le reste", async ({ page }) => {
    // Ce ne sont pas deux phrases parmi d'autres : ce sont les engagements qui
    // rendent le reste croyable. S'ils disparaissent d'un remaniement, la page
    // ne remplit plus son office même si elle reste belle.
    await page.goto("/");
    await expect(page.getByText("Aucune offre n’est stockée.")).toBeVisible();
    await expect(
      page.getByText("Nous ne postulons jamais à votre place."),
    ).toBeVisible();
  });

  test("ne prétend pas qu'on puisse s'inscrire", async ({ page }) => {
    // Les inscriptions sont fermées. Un bouton d'espoir menant à un mur est
    // pire qu'une page qui dit franchement pour qui elle est aujourd'hui.
    await page.goto("/");
    await expect(page.getByText(/bêta privée/i)).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /créer un compte|s’inscrire|inscription/i,
      }),
    ).toHaveCount(0);
  });

  test("aucun débordement horizontal à 390 px, et le dessin reste lisible", async ({
    page,
  }) => {
    // Le dessin large tient dans 1000 unités ; écrasé sur un téléphone ses
    // annotations tombaient à quatre pixels. Une variante compacte le remplace,
    // et l'une des deux doit toujours être la seule visible.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const debordement = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(debordement).toBe(false);

    const dessinsVisibles = await page
      .locator("svg[role='img']")
      .locator("visible=true")
      .count();
    expect(dessinsVisibles).toBe(1);
  });

  // Pas de test « un visiteur connecté est redirigé » ici : il faudrait une
  // session, et sans elle un tel test n'aurait vérifié que l'URL d'un visiteur
  // anonyme sous un nom qui promet autre chose. La redirection est déjà
  // traversée par onboarding.spec.ts et smoke.spec.ts, qui se connectent
  // vraiment. Une couverture qui ment sur ce qu'elle couvre est pire qu'une
  // couverture absente.
});
