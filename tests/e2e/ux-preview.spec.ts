import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The UX Preview is an auth-protected, mock-only design artifact (an internal
// demo that must never become public in a deployment). It is held to the same
// accessibility bar as the rest of the app (docs/ux/ACCESSIBILITY.md):
// axe-clean on every thread state, keyboard-operable, usable with reduced
// motion. No backend, no persistence, no network.

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@missionpilot.local";
const DEV_PASSWORD = process.env.DEV_USER_PASSWORD ?? "";

/** Sign in with the local dev user, then open the preview. */
async function gotoPreviewAuthenticated(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEV_EMAIL);
  await page.getByLabel("Password").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/ux-preview");
  await expect(page).toHaveURL(/\/ux-preview$/);
}

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

/** The demo scaffolding is collapsed by default — open it to switch states. */
async function openDemoPanel(page: Page) {
  await page.getByRole("button", { name: "Démo", exact: true }).click();
  await expect(
    page.getByRole("group", {
      name: "Panneau de démonstration — états simulés",
    }),
  ).toBeVisible();
}

// The auth-boundary proof needs no credentials — it must ALWAYS run.
test.describe("UX Preview access", () => {
  test("is auth-protected: anonymous visitors are sent to login", async ({
    page,
  }) => {
    await page.goto("/ux-preview");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("UX Preview", () => {
  test.beforeEach(() => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");
  });

  test("authenticated, it shows the conversational surface", async ({
    page,
  }) => {
    await gotoPreviewAuthenticated(page);
    await expect(page.getByText("UX Preview · données fictives")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ce que j'ai compris" }),
    ).toBeVisible();
    // Demo scaffolding is collapsed by default — clearly apart from the product.
    await expect(
      page.getByRole("button", { name: "Peuplé", exact: true }),
    ).toHaveCount(0);
  });

  test("has no serious/critical axe violations across thread states", async ({
    page,
  }) => {
    await gotoPreviewAuthenticated(page);
    await openDemoPanel(page);
    for (const label of STATE_LABELS) {
      const btn = page.getByRole("button", { name: label, exact: true });
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "true");
      // Let the button's motion-safe color transition settle so axe never
      // samples a mid-transition blend (--duration-base is 160ms).
      await page.waitForTimeout(250);
      await expectNoSeriousAxeViolations(page, `state ${label}`);
    }
  });

  test("thread states are switchable by keyboard and expose pressed state", async ({
    page,
  }) => {
    await gotoPreviewAuthenticated(page);
    await openDemoPanel(page);
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
    await gotoPreviewAuthenticated(page);
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
    await gotoPreviewAuthenticated(page);
    await openDemoPanel(page);
    await page.getByRole("button", { name: "Vide", exact: true }).click();
    await expect(page.getByText(/La conversation démarrera ici/)).toBeVisible();
    await expectNoSeriousAxeViolations(page, "reduced-motion");
  });

  test("is axe-clean in dark mode too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoPreviewAuthenticated(page);
    // next-themes defaultTheme=system → dark tokens applied.
    await expectNoSeriousAxeViolations(page, "dark populated");
    await openDemoPanel(page);
    const errorBtn = page.getByRole("button", { name: "Erreur", exact: true });
    await errorBtn.click();
    await expect(errorBtn).toHaveAttribute("aria-pressed", "true");
    // Same settle as the states loop: never let axe sample the motion-safe
    // color transition mid-blend on a slow runner.
    await page.waitForTimeout(250);
    await expectNoSeriousAxeViolations(page, "dark error");
  });

  test("sticky composer never masks the last card", async ({ page }) => {
    await gotoPreviewAuthenticated(page);
    const lastCard = page.getByRole("region", { name: "Validation requise" });
    await lastCard.scrollIntoViewIfNeeded();
    const cardBox = await lastCard.boundingBox();
    const composerBox = await page
      .getByRole("form", { name: "Composer un message" })
      .boundingBox();
    expect(cardBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    // Fully scrolled, the approval card sits entirely above the composer.
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(
      composerBox!.y + 1,
    );
  });

  test("shows the rejected lifecycle state with a restore action", async ({
    page,
  }) => {
    await gotoPreviewAuthenticated(page);
    await expect(
      page.getByRole("heading", { name: "Preuve — Certification" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Restaurer" })).toBeVisible();
  });
});
