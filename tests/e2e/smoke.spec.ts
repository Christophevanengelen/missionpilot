import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 0 smoke journey (PHASE_0_BOOTSTRAP acceptance): anonymous redirect →
// sign-in → dashboard → diagnostics → sign-out, with an axe accessibility
// scan on each page. Axe is a partial, automated check — it complements but
// never replaces the documented manual keyboard pass (see README).

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@missionpilot.local";
const DEV_PASSWORD = process.env.DEV_USER_PASSWORD ?? "";

async function expectNoSeriousAxeViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    `${context}: serious/critical axe violations: ${serious
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)
      .join("; ")}`,
  ).toEqual([]);
}

test.describe("phase 0 smoke journey", () => {
  test("anonymous → login → dashboard → diagnostics → sign out, axe-clean", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    // The shell must render without ANY external resource (Codex review, J6):
    // every request stays on localhost/127.0.0.1.
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
        externalRequests.push(request.url());
      }
    });

    // Anonymous access is redirected.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expectNoSeriousAxeViolations(page, "login page");

    // Sign in.
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Two-faced dashboard (hero vs status); the title id is stable in both.
    await expect(page.locator("#dashboard-title")).toBeVisible();
    await expectNoSeriousAxeViolations(page, "dashboard");

    // The profile — the only other destination in the shell.
    await page.getByRole("link", { name: "Mon profil" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expectNoSeriousAxeViolations(page, "profile");

    // Diagnostics is operations, not product: it is still served and still
    // protected, but it has no seat in the navigation, so it is reached by URL.
    await page.goto("/diagnostics");
    await expect(
      page.getByRole("heading", { name: "Runs & Quality" }),
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page, "diagnostics");

    // Sign out invalidates protected access.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/diagnostics");
    await expect(page).toHaveURL(/\/login$/);

    expect(
      externalRequests,
      `external requests detected: ${externalRequests.join(", ")}`,
    ).toEqual([]);
  });
});
