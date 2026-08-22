import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import type { ApplicationDraft } from "@/lib/matching/ai-tailor";
import { loadDraft, upsertDraft } from "@/lib/matching/tailor-logic";
import { getOwnProfile, importDiscovered } from "@/lib/opportunity/logic";

// Integration proof: the ONE-live-draft persistence — upsert stores the
// tailored cover letter + highlights, a refresh REPLACES it, loadDraft reads
// it back typed — through a REAL session (RLS in force). Requires
// `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p6-draft-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;
let profileId: string;
let opportunityId: string;
let session: ReturnType<typeof sessionClient>;

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const AD: DiscoveredAd = {
  title: "Data Engineer",
  organization: "Nova SA",
  description: "Spark, Airflow.",
  locationText: "Bruxelles",
  sourceUrl: "https://www.adzuna.fr/land/ad/654",
  engagementType: "permanent",
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  postedAt: null,
  rawText: "Data Engineer\nchez Nova SA\n\nSpark, Airflow.",
};

const DRAFT: ApplicationDraft = {
  subject: "Candidature — Data Engineer chez Nova SA",
  coverLetter:
    "Madame, Monsieur,\nData engineer senior, j'ai conçu des pipelines Spark " +
    "[à compléter : ex. traitant N To/jour]. …\nCordialement.",
  highlights: [
    "Pipelines Spark et Airflow en production",
    "Encadrement d'équipe",
  ],
  needsReview: false,
  model: "mock-v1",
  promptVersion: "application-tailor-3",
  cvVariantName: null,
  cvVariantRationale: null,
  usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.001 },
};

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  userId = created.data.user.id;
  session = sessionClient();
  await session.auth.signInWithPassword({ email, password });
  profileId = (await getOwnProfile(session)).id;
  const imported = await importDiscovered(session, AD, "Adzuna");
  opportunityId = imported.opportunity_id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("application draft persistence (through the DB, RLS)", () => {
  it("stores the tailored draft and reads it back typed", async () => {
    await upsertDraft(session, profileId, opportunityId, DRAFT, "a".repeat(64));

    const stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.cover_letter).toContain("[à compléter");
    expect(stored?.highlights).toHaveLength(2);
    expect(stored?.needs_review).toBe(false);
    expect(stored?.input_hash).toBe("a".repeat(64));
  });

  it("a refresh REPLACES the live draft (never stacks)", async () => {
    await upsertDraft(
      session,
      profileId,
      opportunityId,
      { ...DRAFT, coverLetter: "Nouvelle version.", needsReview: true },
      "b".repeat(64),
    );
    const stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.cover_letter).toBe("Nouvelle version.");
    expect(stored?.needs_review).toBe(true);
    expect(stored?.input_hash).toBe("b".repeat(64));

    const { data: rows, error } = await session
      .from("ai_application_drafts")
      .select("id")
      .eq("opportunity_id", opportunityId);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it("records which CV variant the draft accompanies, and survives its deletion", async () => {
    const { data: variant, error } = await session
      .from("cv_variants")
      .insert({
        profile_id: profileId,
        name: "Design Lead",
        headline: "Design Lead / Lead Product Designer",
        use_when: "Design leadership searches.",
        file_name: "CV_Design_Lead.pdf",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    await upsertDraft(
      session,
      profileId,
      opportunityId,
      {
        ...DRAFT,
        cvVariantName: "Design Lead",
        cvVariantRationale: "Recherche design leadership.",
      },
      "c".repeat(64),
      variant!.id,
    );
    let stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.cv_variant_id).toBe(variant!.id);
    expect(stored?.cv_variant_rationale).toBe("Recherche design leadership.");

    // Deleting the variant clears the reference AND the rationale (DB
    // trigger), but never the draft itself.
    const del = await session
      .from("cv_variants")
      .delete()
      .eq("id", variant!.id);
    expect(del.error).toBeNull();

    stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.cover_letter).toContain("Madame, Monsieur");
    expect(stored?.cv_variant_id).toBeNull();
    expect(stored?.cv_variant_rationale).toBeNull();
  });

  // Apply Pack L3: subject, language and the exact tone_contract VERSION a
  // draft was generated under. Publishing version 2 must never repoint a
  // draft that cites version 1 — the DB grants no update/delete to
  // `authenticated` on tone_contracts, so this is a database guarantee, not
  // just app discipline.
  it("records subject, language and the exact tone_contract version it was generated under — never repointed by a later version", async () => {
    const v1 = await session
      .from("tone_contracts")
      .insert({
        profile_id: profileId,
        version: 1,
        voice_rules: "Ton direct, phrases courtes.",
        signature_name: "A. Dupont",
        salutation_fr: "Madame, Monsieur,",
        salutation_en: "Dear Hiring Manager,",
        closing_fr: "Cordialement,",
        closing_en: "Best regards,",
      })
      .select("id")
      .single();
    expect(v1.error).toBeNull();

    await upsertDraft(
      session,
      profileId,
      opportunityId,
      { ...DRAFT, subject: "Application — Data Engineer" },
      "d".repeat(64),
      null,
      "en",
      v1.data!.id,
    );
    let stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.subject).toBe("Application — Data Engineer");
    expect(stored?.language).toBe("en");
    expect(stored?.tone_contract_id).toBe(v1.data!.id);

    // Publishing version 2 for the SAME profile must not touch v1, and must
    // not silently repoint the draft that already cites v1.
    const v2 = await session
      .from("tone_contracts")
      .insert({
        profile_id: profileId,
        version: 2,
        voice_rules: "Ton direct, plus court encore.",
        signature_name: "A. Dupont",
        salutation_fr: "Bonjour,",
        salutation_en: "Hello,",
        closing_fr: "Bien à vous,",
        closing_en: "Regards,",
      })
      .select("id")
      .single();
    expect(v2.error).toBeNull();
    expect(v2.data!.id).not.toBe(v1.data!.id);

    stored = await loadDraft(session, profileId, opportunityId);
    expect(stored?.tone_contract_id).toBe(v1.data!.id);

    // Append-only at the DB layer: authenticated has no UPDATE grant.
    const updateAttempt = await session
      .from("tone_contracts")
      .update({ voice_rules: "hijacked" })
      .eq("id", v1.data!.id);
    expect(updateAttempt.error?.code).toBe("42501");
  });
});
