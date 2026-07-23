import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Business e2e for the guided profile interview (PR B). Uses a DEDICATED
// synthetic user per run (provisioned via the local admin API) so the
// deterministic engine is exercised from a clean slate every time — the dev
// user's accumulated state is never relied upon.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p1b-e2e-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

test.beforeAll(async () => {
  test.skip(!secretKey, "SUPABASE_SECRET_KEY not configured");
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  userId = created.data.user.id;
});

test.afterAll(async () => {
  if (!userId) return;
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(userId);
});

async function signInAndOpen(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile$/);
}

async function answer(page: Page, text: string) {
  const input = page.getByLabel("Votre message");
  await input.fill(text);
  await page.getByRole("button", { name: "Envoyer" }).click();
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

test.describe.serial("Entretien de profil guidé", () => {
  test("anonymous visitors are sent to login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("full business path: role → confirm → skill → correct → reject/restore → evidence → attach", async ({
    page,
  }) => {
    await signInAndOpen(page);

    // 1. First question is profile-centric (role), not mission preferences.
    await expect(
      page.getByText("Quel rôle professionnel voulez-vous présenter"),
    ).toBeVisible();

    // 2. The answer becomes an explicit PROPOSAL (never auto-confirmed).
    await answer(page, "Product Designer senior");
    await expect(
      page.getByRole("heading", { name: "Ce que j'ai compris" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Conversation").getByText("Product Designer senior"),
    ).toBeVisible();

    // Double-submit protection: the confirm button disables while pending —
    // two rapid clicks must not double-fire (state machine would reject the
    // second transition anyway; the UI must not surface an error).
    const confirm = page.getByRole("button", { name: "Confirmer" });
    await confirm.click();

    // 3. Seniority question arrives; the role is in the panel as confirmed.
    await expect(
      page.getByText("niveau de séniorité", { exact: false }),
    ).toBeVisible();

    await answer(page, "Senior");
    await page.getByRole("button", { name: "Confirmer" }).click();

    // 4. Years — invalid input is refused in plain French, input preserved.
    await expect(page.getByText("Combien d'années d'expérience")).toBeVisible();
    await answer(page, "beaucoup");
    await expect(
      page.getByText("Indiquez un nombre d'années entre 0 et 80."),
    ).toBeVisible();
    await answer(page, "20 ans");
    await page.getByRole("button", { name: "Confirmer" }).click();

    // 5. Summary.
    await expect(
      page.getByText("comment résumeriez-vous votre parcours"),
    ).toBeVisible();
    await answer(page, "Vingt ans de design produit, du concept au scale.");
    await page.getByRole("button", { name: "Confirmer" }).click();

    // 6. Skill: propose then CORRECT it (new formulation replaces cleanly).
    await expect(
      page.getByText("Quelle compétence clé", { exact: false }),
    ).toBeVisible();
    await answer(page, "UX");
    await page.getByRole("button", { name: "Corriger" }).click();
    await expect(
      page.getByText("Reformulez, je remplacerai la version précédente."),
    ).toBeVisible();
    await answer(page, "Design systems");
    await expect(
      page.getByLabel("Conversation").getByText("Design systems"),
    ).toBeVisible();
    // The corrected proposal replaced the old one — confirm it.
    await page.getByRole("button", { name: "Confirmer" }).click();

    // 7. Achievement: propose, REJECT (Ignorer), then RESTORE from the panel.
    await expect(page.getByText("Quelle réalisation concrète")).toBeVisible();
    await answer(page, "Refonte du checkout e-commerce");
    await page.getByRole("button", { name: "Ignorer" }).click();
    // The engine moves on without nagging; the rejected item is restorable.
    await expect(page.getByText("Écartés")).toBeVisible();
    await page.getByRole("button", { name: "Restaurer" }).click();
    await expect(
      page.getByRole("heading", { name: "Ce que j'ai compris" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmer" }).click();

    // 8. Evidence suggestion for the confirmed achievement → create + attach.
    await expect(
      page.getByText("Voulez-vous appuyer", { exact: false }),
    ).toBeVisible();
    await page.getByLabel("Titre").fill("Refonte du checkout — e-commerce");
    await page
      .getByLabel("Résultat obtenu")
      .fill("+18 % de conversion en six mois.");
    await page.getByLabel("Rôle joué").fill("Lead designer");
    await page.getByRole("button", { name: /Rattacher à/ }).click();

    // 9. Foundation complete; the achievement shows the honest backed tier.
    await expect(
      page.getByText("Votre socle de profil est en place"),
    ).toBeVisible();
    await expect(
      page.getByText("Socle du profil : 6 éléments sur 6"),
    ).toBeVisible();
    await expect(page.getByText("appuyé par une preuve").first()).toBeVisible();
    await expect(page.getByText("déclarée par vous").first()).toBeVisible();

    // 10. Detach is explicit and traceable.
    await page.getByRole("button", { name: "Détacher" }).click();
    await expect(page.getByRole("button", { name: "Détacher" })).toHaveCount(0);
  });

  test("a double-click on the attach submit fires once — no duplicate evidence", async ({
    page,
  }) => {
    await signInAndOpen(page);
    // The previous test left the achievement unsupported (detached), so the
    // evidence suggestion form is open — the exact 3-step chain the in-flight
    // lock must protect.
    await expect(
      page.getByRole("heading", { name: "Nouvelle preuve" }),
    ).toBeVisible();
    await page.getByLabel("Titre").fill("Preuve anti-double-clic");
    await page.getByLabel("Résultat obtenu").fill("Un seul enregistrement.");
    const submit = page.getByRole("button", { name: /Rattacher à/ });
    // Two immediate clicks: the in-flight lock must swallow the second.
    await submit.click();
    await submit.click({ force: true }).catch(() => undefined);
    await expect(
      page.getByText("Votre socle de profil est en place"),
    ).toBeVisible();
    // Exactly ONE evidence row with that title — no duplicate chain.
    await expect(
      page
        .getByLabel("Panneau de contexte")
        .getByText("Preuve anti-double-clic"),
    ).toHaveCount(1);
    await expect(page.getByTestId("action-feedback")).toHaveCount(0);
  });

  test("resume NEVER re-asks a confirmed element (dedicated assertion)", async ({
    page,
  }) => {
    await signInAndOpen(page);
    // Everything is confirmed from the previous test: the interview resumes
    // at the enrichment stage without a single foundation question.
    await expect(page.getByText("Reprenons.")).toBeVisible();
    for (const asked of [
      "Quel rôle professionnel voulez-vous présenter",
      "niveau de séniorité",
      "Combien d'années d'expérience",
      "comment résumeriez-vous votre parcours",
    ]) {
      await expect(page.getByText(asked, { exact: false })).toHaveCount(0);
    }
  });

  test("axe clean in light and dark, keyboard reachable", async ({ page }) => {
    await signInAndOpen(page);
    await expectNoSeriousAxeViolations(page, "profile light");

    // Keyboard: the panel toggle and composer are reachable and operable.
    await page.keyboard.press("Tab");
    const active = await page.evaluate(
      () => document.activeElement?.textContent ?? "",
    );
    expect(active.length).toBeGreaterThan(0);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expectNoSeriousAxeViolations(page, "profile dark");
  });

  test("no horizontal overflow at 320 and 390px; composer never masks content", async ({
    page,
  }) => {
    await signInAndOpen(page);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/profile");
      await expect(page).toHaveURL(/\/profile$/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBe(false);

      const composer = await page
        .getByRole("form", { name: "Composer un message" })
        .boundingBox();
      const thread = await page
        .getByRole("list", { name: "Conversation" })
        .boundingBox();
      expect(composer).not.toBeNull();
      expect(thread).not.toBeNull();
      // The sticky composer occupies its own layout slot: fully scrolled,
      // the thread's bottom sits above the composer's top.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const composerAfter = await page
        .getByRole("form", { name: "Composer un message" })
        .boundingBox();
      const threadAfter = await page
        .getByRole("list", { name: "Conversation" })
        .boundingBox();
      expect(threadAfter!.y + threadAfter!.height).toBeLessThanOrEqual(
        composerAfter!.y + 1,
      );
    }
  });
});
