import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import type { InterviewBrief } from "@/lib/matching/ai-interview";
import { loadBrief, upsertBrief } from "@/lib/matching/interview-logic";
import { getOwnProfile, importDiscovered } from "@/lib/opportunity/logic";

// Integration proof: the ONE-live-brief persistence — upsert stores the
// interview questions + talking points, a refresh REPLACES it, loadBrief reads
// it back typed — through a REAL session (RLS in force). Requires
// `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p13-brief-${randomUUID()}@test.local`;
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
  sourceUrl: "https://www.adzuna.fr/land/ad/888",
  engagementType: "permanent",
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  rawText: "Data Engineer\nchez Nova SA\n\nSpark, Airflow.",
};

const BRIEF: InterviewBrief = {
  questions: [
    {
      question: "Comment avez-vous conçu vos pipelines Spark ?",
      angle:
        "S'appuyer sur l'expérience Nova du profil [à compléter : volume].",
    },
  ],
  talkingPoints: ["Pipelines Spark et Airflow en production"],
  needsReview: false,
  model: "mock-v1",
  promptVersion: "interview-brief-1",
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

describe("interview brief persistence (through the DB, RLS)", () => {
  it("stores the brief and reads it back typed", async () => {
    await upsertBrief(session, profileId, opportunityId, BRIEF, "a".repeat(64));

    const stored = await loadBrief(session, profileId, opportunityId);
    expect(stored?.questions).toHaveLength(1);
    expect(stored?.questions[0].angle).toContain("[à compléter");
    expect(stored?.talkingPoints).toHaveLength(1);
    expect(stored?.needs_review).toBe(false);
    expect(stored?.input_hash).toBe("a".repeat(64));
  });

  it("a refresh REPLACES the live brief (never stacks)", async () => {
    await upsertBrief(
      session,
      profileId,
      opportunityId,
      { ...BRIEF, questions: [], needsReview: true },
      "b".repeat(64),
    );
    const stored = await loadBrief(session, profileId, opportunityId);
    expect(stored?.questions).toHaveLength(0);
    expect(stored?.needs_review).toBe(true);
    expect(stored?.input_hash).toBe("b".repeat(64));

    const { data: rows, error } = await session
      .from("ai_interview_briefs")
      .select("id")
      .eq("opportunity_id", opportunityId);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
  });
});
