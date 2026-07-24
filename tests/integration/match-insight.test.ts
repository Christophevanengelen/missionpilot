import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import type { MatchInsight } from "@/lib/matching/ai-insight";
import {
  insightInputHash,
  loadInsights,
  upsertInsight,
} from "@/lib/matching/insight-logic";
import { getOwnProfile, importDiscovered } from "@/lib/opportunity/logic";

// Integration proof: the ONE-live-insight persistence — upsert stores, a
// refresh REPLACES (never stacks), loadInsights reads it back typed — through
// a REAL session (RLS in force). Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p5-insight-${randomUUID()}@test.local`;
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
  title: "Head of Data",
  organization: "Nova SA",
  description: "Direction de la plateforme data.",
  locationText: "Bruxelles",
  sourceUrl: "https://www.adzuna.fr/land/ad/999",
  engagementType: "permanent",
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  rawText: "Head of Data\nchez Nova SA\n\nDirection de la plateforme data.",
};

const INSIGHT: MatchInsight = {
  fit: "strong",
  rationale: "Le rôle et les compétences data correspondent clairement.",
  strengths: ["Direction data", "Spark"],
  gaps: ["Management d'équipe non démontré"],
  needsReview: false,
  model: "mock-v1",
  promptVersion: "match-insight-1",
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

describe("match insight persistence (through the DB, RLS)", () => {
  it("stores the insight and reads it back typed", async () => {
    const hash = insightInputHash("dossier v1", "offre v1");
    await upsertInsight(session, profileId, opportunityId, INSIGHT, hash);

    const insights = await loadInsights(session, profileId);
    const stored = insights.get(opportunityId);
    expect(stored?.fit).toBe("strong");
    expect(stored?.rationale).toContain("correspondent");
    expect(stored?.strengths).toEqual(["Direction data", "Spark"]);
    expect(stored?.gaps).toEqual(["Management d'équipe non démontré"]);
    expect(stored?.needs_review).toBe(false);
    expect(stored?.input_hash).toBe(hash);
  });

  it("a refresh REPLACES the live insight (never stacks)", async () => {
    const hash2 = insightInputHash("dossier v2", "offre v1");
    await upsertInsight(
      session,
      profileId,
      opportunityId,
      { ...INSIGHT, fit: "good", needsReview: true },
      hash2,
    );

    const insights = await loadInsights(session, profileId);
    expect(insights.size).toBe(1); // one LIVE insight for the opportunity
    const stored = insights.get(opportunityId);
    expect(stored?.fit).toBe("good");
    expect(stored?.needs_review).toBe(true);
    expect(stored?.input_hash).toBe(hash2);
  });
});
