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
  coverLetter:
    "Madame, Monsieur,\nData engineer senior, j'ai conçu des pipelines Spark " +
    "[à compléter : ex. traitant N To/jour]. …\nCordialement.",
  highlights: [
    "Pipelines Spark et Airflow en production",
    "Encadrement d'équipe",
  ],
  needsReview: false,
  model: "mock-v1",
  promptVersion: "application-tailor-1",
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
});
