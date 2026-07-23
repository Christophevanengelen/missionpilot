import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Critical e2e for Phase 2 opportunity ingestion. Dedicated synthetic user
// per run (admin API), cleaned up in afterAll. Proves: paste → import →
// status panel (created) → inspection (normalized data + unverified banner +
// frozen source + "seen once") → list → re-import → duplicate status → "seen
// twice" (dedup: still one row in the list).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p2-e2e-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

const LISTING = [
  "Senior Platform Engineer",
  "chez Initech",
  "",
  "Location: Lyon, France",
  "Hybrid",
  "",
  "TJM: 650 €/jour",
  "",
  "Skills:",
  "- Kubernetes",
  "- Terraform",
].join("\n");

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

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test("import d'une annonce collée : statut, normalisation, source figée, doublon, dédup", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/opportunities");
  await expect(
    page.getByRole("heading", { name: "Opportunités" }),
  ).toBeVisible();

  // Paste + import → honest "created" status (no auto-navigation).
  await page.getByLabel("Coller le texte d'une annonce").fill(LISTING);
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  const status = page.getByRole("status");
  await expect(status.getByText("Opportunité importée.")).toBeVisible();
  await expect(page).toHaveURL(/\/opportunities$/); // still on the import page

  // Follow the explicit link to the inspection screen.
  await page.getByRole("link", { name: "Voir l'opportunité" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Senior Platform Engineer" }),
  ).toBeVisible();
  // Seen exactly once so far.
  await expect(page.getByText("Vue 1 fois")).toBeVisible();
  // Deterministic hard-constraint gate renders (no preferences set ⇒ Éligible).
  const constraints = page.getByRole("region", { name: "Contraintes dures" });
  await expect(constraints).toBeVisible();
  await expect(constraints.getByText("Éligible")).toBeVisible();
  // Honesty: the unverified banner is present (scoped to the note landmark —
  // the hard-constraints section also mentions "non vérifiées").
  await expect(page.getByRole("note")).toContainText("non vérifiées");
  // Normalized fields extracted from the source (scoped to the normalized
  // section — the same words also appear in the frozen source capture).
  const normalized = page.getByRole("region", {
    name: "Données normalisées",
  });
  await expect(normalized.getByText("Initech", { exact: true })).toBeVisible();
  await expect(normalized.getByText("Hybride")).toBeVisible();
  await expect(normalized.getByText("Kubernetes")).toBeVisible();
  // The frozen source capture shows the exact pasted text.
  const source = page.getByRole("region", { name: /Capture source/ });
  await expect(source.getByText("TJM: 650 €/jour")).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  // The list shows exactly one opportunity.
  await page.getByRole("link", { name: "Retour aux opportunités" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(
    page.getByRole("article").filter({ hasText: "Senior Platform Engineer" }),
  ).toHaveCount(1);

  // Re-importing the same listing is reported as a DUPLICATE (honest status),
  // appends a snapshot, and does not create a second row.
  await page.getByLabel("Coller le texte d'une annonce").fill(LISTING);
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  await expect(
    page.getByRole("status").getByText(/Déjà importée/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voir l'opportunité" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  // Seen count reflects the second import.
  await expect(page.getByText("Vue 2 fois")).toBeVisible();

  await page.getByRole("link", { name: "Retour aux opportunités" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Senior Platform Engineer" }),
  ).toHaveCount(1);
});

test("import par URL : source bloquée refusée honnêtement, source publique enregistrée comme provenance", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/opportunities");

  // A terms-forbidden source is refused with a specific, honest message —
  // and nothing is fetched.
  await page
    .getByLabel("Lien de l'annonce (facultatif)")
    .fill("https://www.linkedin.com/jobs/123");
  await page
    .getByLabel("Coller le texte d'une annonce")
    .fill("Data Engineer\nchez Cyberdyne\nRemote");
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  await expect(
    page.getByText(/conditions de ce site interdisent/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/opportunities$/); // no navigation on block

  // A public URL is accepted as provenance (still pasted, never fetched).
  await page
    .getByLabel("Lien de l'annonce (facultatif)")
    .fill("https://jobs.example.com/data-eng");
  await page.getByRole("button", { name: "Importer l'annonce" }).click();
  await expect(
    page.getByRole("status").getByText("Opportunité importée."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voir l'opportunité" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  // The source link is shown as provenance (plain text, never a live link).
  const normalized = page.getByRole("region", { name: "Données normalisées" });
  await expect(
    normalized.getByText("https://jobs.example.com/data-eng"),
  ).toBeVisible();
  await expect(
    normalized.getByRole("link", { name: /jobs\.example\.com/ }),
  ).toHaveCount(0);
});
