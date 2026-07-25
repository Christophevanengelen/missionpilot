import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import type { MatchBreakdown } from "@/lib/matching/ai-breakdown";
import { loadBreakdown, upsertBreakdown } from "@/lib/matching/breakdown-logic";
import { getOwnProfile, importDiscovered } from "@/lib/opportunity/logic";

// Integration proof: the ONE-live-breakdown persistence — upsert stores the
// per-requirement report, a refresh REPLACES it, loadBreakdown reads it back
// typed — through a REAL session (RLS in force). Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p6-breakdown-${randomUUID()}@test.local`;
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
  description: "Spark, Airflow, dbt.",
  locationText: "Bruxelles",
  sourceUrl: "https://www.adzuna.fr/land/ad/321",
  engagementType: "permanent",
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  postedAt: null,
  rawText: "Data Engineer\nchez Nova SA\n\nSpark, Airflow, dbt.",
};

const BREAKDOWN: MatchBreakdown = {
  summary: "Bonne adéquation data avec un écart sur dbt.",
  requirements: [
    {
      text: "Spark",
      importance: "must",
      status: "covered",
      evidence: "Pipelines Spark chez Nova.",
      suggestion: "",
    },
    {
      text: "dbt",
      importance: "nice",
      status: "missing",
      evidence: "Non mentionné dans le profil.",
      suggestion: "Suivre une formation dbt courte pour combler l'écart.",
    },
  ],
  needsReview: false,
  model: "mock-v1",
  promptVersion: "match-breakdown-1",
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

describe("match breakdown persistence (through the DB, RLS)", () => {
  it("stores the per-requirement report and reads it back typed", async () => {
    await upsertBreakdown(
      session,
      profileId,
      opportunityId,
      BREAKDOWN,
      "a".repeat(64),
    );

    const stored = await loadBreakdown(session, profileId, opportunityId);
    expect(stored?.summary).toContain("écart");
    expect(stored?.requirements).toHaveLength(2);
    expect(stored?.requirements[0]).toMatchObject({
      text: "Spark",
      status: "covered",
    });
    expect(stored?.requirements[1]).toMatchObject({
      text: "dbt",
      status: "missing",
      suggestion: "Suivre une formation dbt courte pour combler l'écart.",
    });
    expect(stored?.input_hash).toBe("a".repeat(64));
  });

  it("a refresh REPLACES the live breakdown (never stacks)", async () => {
    await upsertBreakdown(
      session,
      profileId,
      opportunityId,
      { ...BREAKDOWN, summary: "Analyse rafraîchie.", needsReview: true },
      "b".repeat(64),
    );
    const stored = await loadBreakdown(session, profileId, opportunityId);
    expect(stored?.summary).toBe("Analyse rafraîchie.");
    expect(stored?.needs_review).toBe(true);
    expect(stored?.input_hash).toBe("b".repeat(64));

    // Still exactly one row for this opportunity (a stacked insert would make
    // loadBreakdown's maybeSingle throw; this pins the count explicitly).
    const { data: rows, error } = await session
      .from("ai_match_breakdowns")
      .select("id")
      .eq("opportunity_id", opportunityId);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
  });
});
