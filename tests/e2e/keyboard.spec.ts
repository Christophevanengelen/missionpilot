import { expect, test, type Page } from "@playwright/test";

// Scripted keyboard pass: Tab/Enter-only interaction, mirroring the manual
// checklist documented in the README. This automates the regression side of
// the keyboard audit; it does not replace a periodic human pass.

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@missionpilot.local";
const DEV_PASSWORD = process.env.DEV_USER_PASSWORD ?? "";

async function activeElementInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      text: (el.textContent ?? "").trim().slice(0, 60),
      id: el.id,
      tag: el.tagName.toLowerCase(),
      focusVisible: el.matches(":focus-visible"),
      hasVisibleFocusStyle:
        style.outlineStyle !== "none" || style.boxShadow !== "none",
    };
  });
}

async function tabUntil(
  page: Page,
  predicate: (
    info: NonNullable<Awaited<ReturnType<typeof activeElementInfo>>>,
  ) => boolean,
  maxTabs = 25,
): Promise<NonNullable<Awaited<ReturnType<typeof activeElementInfo>>>> {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press("Tab");
    const info = await activeElementInfo(page);
    if (info && predicate(info)) {
      return info;
    }
  }
  throw new Error(`target not reached within ${maxTabs} tabs`);
}

test.describe("keyboard-only interaction", () => {
  test("skip link is first in tab order and jumps to main content", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const first = await activeElementInfo(page);
    expect(first?.text).toBe("Skip to main content");
    expect(first?.focusVisible).toBe(true);
    expect(first?.hasVisibleFocusStyle).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    const afterSkip = await page.evaluate(
      () => document.activeElement?.id ?? "",
    );
    expect(afterSkip).toBe("main");
  });

  test("login form is fully operable with the keyboard, in a sane tab order", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    const email = await tabUntil(page, (i) => i.id === "email");
    expect(email.focusVisible).toBe(true);
    await page.keyboard.type(DEV_EMAIL);

    const password = await tabUntil(page, (i) => i.id === "password");
    expect(password.focusVisible).toBe(true);
    await page.keyboard.type(DEV_PASSWORD);

    const submit = await tabUntil(
      page,
      (i) => i.tag === "button" && i.text === "Sign in",
    );
    expect(submit.hasVisibleFocusStyle).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("primary navigation and sign-out are keyboard reachable with visible focus", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const signOut = await tabUntil(
      page,
      (i) => i.tag === "button" && i.text === "Sign out",
    );
    expect(signOut.hasVisibleFocusStyle).toBe(true);

    const navLink = await tabUntil(
      page,
      (i) => i.tag === "a" && i.text.startsWith("Mon profil"),
    );
    expect(navLink.focusVisible).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("diagnostics trigger via keyboard: error is announced and focus is preserved", async ({
    page,
  }) => {
    test.skip(!DEV_PASSWORD, "DEV_USER_PASSWORD not configured");

    await page.goto("/login");
    await page.getByLabel("Email").fill(DEV_EMAIL);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/diagnostics");
    // Wait past the Suspense loading state before traversing the tab order.
    await expect(
      page.getByRole("button", { name: "Run health check" }),
    ).toBeVisible();

    const trigger = await tabUntil(
      page,
      (i) => i.tag === "button" && i.text.includes("Run health check"),
    );
    expect(trigger.hasVisibleFocusStyle).toBe(true);
    await page.keyboard.press("Enter");

    // Without the Inngest dev server the dispatch fails with a sanitized
    // message; focus must stay on (or return to) the trigger button.
    await expect(page.locator("#trigger-status")).toContainText(
      "Could not reach the workflow engine",
    );
    const after = await activeElementInfo(page);
    expect(after?.tag).toBe("button");
    expect(after?.text).toContain("Run health check");
  });
});
