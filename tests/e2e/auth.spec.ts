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
      page.getByRole("heading", { name: "Sign in to MissionPilot" }),
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
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // #login-error, not getByRole("alert"): Next's route announcer is also
    // role=alert and trips Playwright's strict mode.
    await expect(page.locator("#login-error")).toHaveText(
      "Invalid email or password.",
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test("dev user signs in, reaches the dashboard, signs out and loses access", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // The dashboard has two faces (hero vs status) depending on profile state;
    // its title carries a stable id in both, so the assertion is robust.
    await expect(page.locator("#dashboard-title")).toBeVisible();
    await expect(page.getByTestId("session-email")).toHaveText(DEV_EMAIL);

    await page.getByRole("button", { name: "Sign out" }).click();
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
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
