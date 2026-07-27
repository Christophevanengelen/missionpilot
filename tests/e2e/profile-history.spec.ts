import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Critical e2e for the profile history (PR C). The publication flow has no
// UI (owner decision) — versions 1 and 2 are seeded through the EXISTING
// publication contract with the synthetic user's own session (RLS in
// force); the browser journey starts at Profil → Historique.

// The whole file is one ordered chain over a per-run synthetic user: serial
// mode makes CI retries coherent (a retry re-runs the chain from its fresh
// seed instead of leaving later tests against an unexpected state).
test.describe.configure({ mode: "serial" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const email = `p1c-e2e-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;

const ROLE_V1 = "Senior UX/UI Designer";
const ROLE_V2 = "Senior UX Strategist & Service Designer";

async function confirmClaim(
  session: SupabaseClient,
  profileId: string,
  kind: string,
  value: Record<string, unknown>,
  claimToSupersede?: string,
): Promise<string> {
  let claimId: string;
  if (claimToSupersede) {
    const replaced = await session.rpc("replace_profile_claim", {
      p_profile_id: profileId,
      p_kind: kind,
      p_value: value,
      p_origin: "user",
      p_claim_to_supersede: claimToSupersede,
    });
    if (replaced.error) throw new Error(replaced.error.message);
    claimId = replaced.data as string;
  } else {
    const inserted = await session
      .from("profile_claims")
      .insert({ profile_id: profileId, kind, value })
      .select("id")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    claimId = inserted.data.id;
  }
  const confirmed = await session
    .from("profile_claims")
    .update({ state: "confirmed" })
    .eq("id", claimId)
    .select("id")
    .single();
  if (confirmed.error) throw new Error(confirmed.error.message);
  return claimId;
}

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

  // Seed the two versions through the user's OWN session (RLS in force).
  const session = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await session.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(signedIn.error.message);
  const profile = await session
    .from("candidate_profiles")
    .select("id")
    .single();
  if (profile.error) throw new Error(profile.error.message);
  const profileId = profile.data.id as string;

  // Version 1: role + one skill.
  const roleClaim = await confirmClaim(session, profileId, "role", {
    title: ROLE_V1,
  });
  const sketchClaim = await confirmClaim(session, profileId, "skill", {
    name: "Sketch",
  });
  const v1 = await session.rpc("publish_profile_version", {
    p_profile_id: profileId,
    p_change_summary: "Première version publiée du profil.",
  });
  if (v1.error) throw new Error(v1.error.message);

  // Version 2: role reworded (supersede), Figma added, Sketch superseded by
  // a plain proposal (drops out of the confirmed snapshot — a removal).
  await confirmClaim(session, profileId, "role", { title: ROLE_V2 }, roleClaim);
  await confirmClaim(session, profileId, "skill", { name: "Figma" });
  const superseded = await session.rpc("replace_profile_claim", {
    p_profile_id: profileId,
    p_kind: "skill",
    p_value: { name: "Sketch" },
    p_origin: "user",
    p_claim_to_supersede: sketchClaim,
  });
  if (superseded.error) throw new Error(superseded.error.message);
  const v2 = await session.rpc("publish_profile_version", {
    p_profile_id: profileId,
    p_change_summary:
      "Rôle mis à jour · 1 compétence ajoutée · 1 compétence retirée.",
  });
  if (v2.error) throw new Error(v2.error.message);
  await session.auth.signOut();
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
  await page.getByRole("button", { name: "J’ai déjà un mot de passe" }).click();
  await page.getByLabel("Votre e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer" }).click();
  await page.waitForURL(/\/dashboard/);
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

test("historique : liste → version → comparaison → restauration → persistance", async ({
  page,
}) => {
  await signIn(page);

  // 1. Profil → Historique via the panel link.
  await page.goto("/profile");
  // The history link lives on the progress panel now, not buried inside the
  // folded interview where it had become unreachable.
  await page.getByRole("link", { name: "Historique" }).click();
  await expect(page).toHaveURL(/\/profile\/history$/);
  await expect(
    page.getByRole("heading", { name: "Historique du profil" }),
  ).toBeVisible();

  // 2. Both versions listed, newest first, with summaries and the badge.
  const v2Card = page.getByRole("article", { name: "Version 2" });
  const v1Card = page.getByRole("article", { name: "Version 1" });
  await expect(v2Card).toBeVisible();
  await expect(v1Card).toBeVisible();
  await expect(v2Card.getByText("Version la plus récente")).toBeVisible();
  await expect(
    v1Card.getByText("Première version publiée du profil."),
  ).toBeVisible();
  await expect(v2Card.getByText(/Rôle mis à jour/)).toBeVisible();
  await expectNoSeriousAxeViolations(page, "history list");

  // 3. Open version 1: read-only, business labels, no editable control.
  await v1Card.getByRole("link", { name: "Consulter" }).click();
  await expect(page).toHaveURL(/version=1/);
  await expect(
    page.getByText("Vous consultez une version confirmée, en lecture seule", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText(ROLE_V1)).toBeVisible();
  await expect(page.getByText("Sketch")).toBeVisible();
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);

  // 4. Compare 1 → 2: explicit direction, coherent counts, three sections.
  await page.getByRole("link", { name: "Comparer" }).click();
  await expect(page).toHaveURL(/from=1&to=2/);
  await expect(
    page.getByRole("heading", { name: "Version 1 → Version 2" }),
  ).toBeVisible();
  await expect(page.getByText("3 changements")).toBeVisible();
  await expect(
    page.getByText("1 ajout · 1 modification · 1 suppression"),
  ).toBeVisible();
  const added = page.locator('section[aria-label="Ajouté"]');
  await expect(added.getByText("Figma")).toBeVisible();
  const modified = page.locator('section[aria-label="Modifié"]');
  await expect(modified.getByText("Avant")).toBeVisible();
  await expect(modified.getByText(ROLE_V1)).toBeVisible();
  await expect(modified.getByText(ROLE_V2)).toBeVisible();
  const removed = page.locator('section[aria-label="Supprimé"]');
  await expect(removed.getByText("Sketch")).toBeVisible();
  await expectNoSeriousAxeViolations(page, "comparison");

  // 5. Restore version 1: honest warning, then honest traceable outcome.
  await page.goto("/profile/history?version=1");
  await page.getByRole("button", { name: "Restaurer cette version" }).click();
  await expect(
    page.getByText("Cette version remplacera le contenu actuel", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurer cette version" }).click();
  await expect(page.getByText(/Version 1 restaurée/)).toBeVisible();
  await expect(
    page.getByText(/la version 3 retrace cette restauration/),
  ).toBeVisible();

  // 6. Back to the current profile: the restored content is the working
  //    state, and it survives a reload (server is the source of truth).
  await page.getByRole("button", { name: "Revenir au profil actuel" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  // The detailed interview — and its context panel — is folded by default.
  await page.getByText("Reprendre l'entretien détaillé").click();
  const panel = page.getByLabel("Panneau de contexte");
  await expect(panel.getByText(ROLE_V1)).toBeVisible();
  await page.reload();
  await page.getByText("Reprendre l'entretien détaillé").click();
  await expect(panel.getByText(ROLE_V1)).toBeVisible();

  // 7. History intact: versions 1 and 2 unchanged, version 3 traced.
  await page.goto("/profile/history");
  const v3Card = page.getByRole("article", { name: "Version 3" });
  await expect(v3Card).toBeVisible();
  await expect(v3Card.getByText("Version la plus récente")).toBeVisible();
  await expect(
    v3Card.getByText("Issue de la restauration de la version 1"),
  ).toBeVisible();
  await expect(page.getByRole("article", { name: "Version 1" })).toBeVisible();
  await page.goto("/profile/history?version=2");
  await expect(page.getByText(ROLE_V2)).toBeVisible();
  await expect(page.getByText("Figma")).toBeVisible();

  // 8. Restoring version 1 again is an honest no-op (its content is now the
  //    head): nothing mutated, message says so, no ghost version.
  await page.goto("/profile/history?version=1");
  await page.getByRole("button", { name: "Restaurer cette version" }).click();
  await expect(
    page.getByText("Cette version remplacera le contenu actuel", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurer cette version" }).click();
  await expect(
    page.getByText(/Aucune modification n'a été effectuée/),
  ).toBeVisible();
  await page.goto("/profile/history");
  await expect(page.getByRole("article", { name: "Version 3" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Version 4" })).toHaveCount(0);
});

// Order-dependent by design (tests in a file run sequentially with the
// default config): builds on the state the previous test left — working
// profile = restored V1 content (role + one skill), head = version 3.
test("figer une version depuis le profil : création honnête puis no-op honnête (PR D)", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");
  await page.getByText("Reprendre l'entretien détaillé").click();

  // The interview resumes at the first missing foundation element
  // (seniority): answer and confirm it so the confirmed state genuinely
  // differs from the head version.
  await expect(page.getByText("niveau de séniorité")).toBeVisible();
  await page.getByLabel("Votre message").fill("Senior");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await page
    .getByLabel("Conversation")
    .getByRole("button", { name: "Confirmer", exact: true })
    .click();
  // The next question arriving proves the decision was committed.
  await expect(page.getByText("Combien d'années d'expérience")).toBeVisible();

  // Freeze the confirmed state: new version + deterministic summary.
  await page
    .getByRole("button", { name: "Figer une version du profil" })
    .click();
  await expect(
    page.getByText(/Version 4 figée — « Séniorité renseigné/),
  ).toBeVisible();
  await expect(page.getByText("Version actuelle : 4")).toBeVisible();

  // Freeze again: honest no-op — no ghost version is ever created.
  await page
    .getByRole("button", { name: "Figer une version du profil" })
    .click();
  await expect(
    page.getByText(/Aucun changement de fond depuis la version 4/),
  ).toBeVisible();

  await page.goto("/profile/history");
  const v4 = page.getByRole("article", { name: "Version 4" });
  await expect(v4).toBeVisible();
  await expect(v4.getByText("Version la plus récente")).toBeVisible();
  await expect(page.getByRole("article", { name: "Version 5" })).toHaveCount(0);
});
