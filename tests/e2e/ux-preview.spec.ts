import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The UX Preview is a public, mock-only design artifact. It is held to the
// same accessibility bar as the rest of the app (docs/ux/ACCESSIBILITY.md):
// axe-clean on every thread state, keyboard-operable, usable with reduced
// motion. No auth, no backend, no network.

async function expectNoSeriousAxeViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    `${context}: ${serious.map((v) => `${v.id} (${v.impact})`).join("; ")}`,
  ).toEqual([]);
}

const STATE_LABELS = ["Peuplé", "Chargement", "Vide", "Erreur", "Hors ligne"];

test.describe("UX Preview", () => {
  test("loads without auth and shows the conversational surface", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    await expect(page).toHaveURL(/\/ux-preview$/); // not redirected to /login
    await expect(page.getByText("UX Preview · données fictives")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ce que j'ai compris" }),
    ).toBeVisible();
  });

  test("has no serious/critical axe violations across thread states", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    for (const label of STATE_LABELS) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expectNoSeriousAxeViolations(page, `state ${label}`);
    }
  });

  test("thread states are switchable by keyboard and expose pressed state", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    const errorBtn = page.getByRole("button", { name: "Erreur", exact: true });
    await errorBtn.focus();
    await expect(errorBtn).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(errorBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Votre message est conservé/)).toBeVisible();
  });

  test("core cards render: understanding, evidence (needs review), score, approval", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    // Understanding card + its four core actions.
    await expect(
      page.getByRole("button", { name: "Confirmer" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Corriger" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ignorer" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approfondir" }).first(),
    ).toBeVisible();
    // Evidence card in needs_review with an unverified metric.
    await expect(page.getByText("à confirmer").first()).toBeVisible();
    // Explainable score: separate score and confidence, component meters.
    await expect(page.getByRole("meter").first()).toBeVisible();
    // Approval card: decline is present and precedes approve.
    await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approuver et exporter" }),
    ).toBeVisible();
  });

  test("remains usable with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ux-preview");
    await page.getByRole("button", { name: "Vide", exact: true }).click();
    await expect(page.getByText(/La conversation démarrera ici/)).toBeVisible();
    await expectNoSeriousAxeViolations(page, "reduced-motion");
  });

  test("is axe-clean in dark mode too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/ux-preview");
    // next-themes defaultTheme=system → dark tokens applied.
    await expectNoSeriousAxeViolations(page, "dark populated");
    await page.getByRole("button", { name: "Erreur", exact: true }).click();
    await expectNoSeriousAxeViolations(page, "dark error");
  });

  test("shows the rejected lifecycle state with a restore action", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    await expect(
      page.getByRole("heading", { name: "Preuve — Certification" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Restaurer" })).toBeVisible();
  });
});
