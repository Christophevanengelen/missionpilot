import { expect, test } from "@playwright/test";

// Requires: `supabase start` + `pnpm exec tsx scripts/create-dev-user.ts`.
// Runs against a production build (playwright.config.ts webServer).

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@missionpilot.local";
const DEV_PASSWORD = process.env.DEV_USER_PASSWORD ?? "";

test.describe("authentication boundary", () => {
  test("anonymous visitor is redirected from the dashboard to login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "On vous fait monter d'une marche" }),
    ).toBeVisible();
  });

  test("anonymous visitor is redirected from diagnostics to login", async ({
    page,
  }) => {
    await page.goto("/diagnostics");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("invalid credentials are rejected with a sanitized message", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "J’ai déjà un mot de passe" })
      .click();
    await page.getByLabel("Votre e-mail").fill(DEV_EMAIL);
    await page.getByLabel("Mot de passe").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Entrer" }).click();
    // #login-error, not getByRole("alert"): Next's route announcer is also
    // role=alert and trips Playwright's strict mode.
    // Le message était en ANGLAIS dans une interface française — corrigé avec
    // le passage au lien magique. Il reste volontairement indistinct : il ne
    // dit jamais si c'est le compte ou le mot de passe qui est faux, sans quoi
    // il offrirait un moyen de savoir qui a un compte ici.
    await expect(page.locator("#login-error")).toHaveText(
      "E-mail ou mot de passe incorrect.",
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test("dev user signs in, reaches the dashboard, signs out and loses access", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    await page
      .getByRole("button", { name: "J’ai déjà un mot de passe" })
      .click();
    await page.getByLabel("Votre e-mail").fill(DEV_EMAIL);
    await page.getByLabel("Mot de passe").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Entrer" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // The dashboard has two faces (hero vs status) depending on profile state;
    // its title carries a stable id in both, so the assertion is robust.
    await expect(page.locator("#dashboard-title")).toBeVisible();
    await expect(page.getByTestId("session-email")).toHaveText(DEV_EMAIL);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Signed-out session must no longer reach protected content.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login page redirects an already-authenticated user to the dashboard", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    await page
      .getByRole("button", { name: "J’ai déjà un mot de passe" })
      .click();
    await page.getByLabel("Votre e-mail").fill(DEV_EMAIL);
    await page.getByLabel("Mot de passe").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
