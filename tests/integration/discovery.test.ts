import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import {
  getLatestSnapshot,
  getOpportunity,
  getOwnProfile,
  importDiscovered,
} from "@/lib/opportunity/logic";

// Integration proof: a DISCOVERED ad flows through the standard import
// pipeline (structured overrides, immutable snapshot with
// retrieval_method='import', per-owner dedup) through a REAL session (RLS).
// Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p4-disc-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;
let session: ReturnType<typeof sessionClient>;

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const AD: DiscoveredAd = {
  title: "Senior Data Engineer",
  organization: "Scaleup SA",
  description: "Pipeline Spark et Airflow pour une scale-up en croissance.",
  locationText: "Paris, Île-de-France",
  sourceUrl: "https://www.adzuna.fr/land/ad/123",
  engagementType: "permanent",
  compensationMin: 50000,
  compensationMax: 65000,
  compensationCurrency: "EUR",
  compensationPeriod: "year",
  postedAt: null,
  rawText:
    "Senior Data Engineer\nchez Scaleup SA\nLocation: Paris, Île-de-France\n\nPipeline Spark et Airflow pour une scale-up en croissance.",
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
  await getOwnProfile(session);
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("discovered-ad import (through the DB, RLS)", () => {
  it("stores structured fields, provenance and an immutable import snapshot", async () => {
    const result = await importDiscovered(session, AD, "Adzuna");
    expect(result.created).toBe(true);

    const opp = await getOpportunity(session, result.opportunity_id);
    expect(opp?.title).toBe("Senior Data Engineer");
    expect(opp?.organization).toBe("Scaleup SA");
    expect(opp?.engagement_type).toBe("permanent");
    expect(opp?.compensation_min).toBe(50000);
    expect(opp?.compensation_max).toBe(65000);
    expect(opp?.compensation_currency).toBe("EUR");
    expect(opp?.compensation_period).toBe("year");
    expect(opp?.source_name).toBe("Adzuna");
    expect(opp?.source_url).toBe("https://www.adzuna.fr/land/ad/123");

    const snap = await getLatestSnapshot(session, result.opportunity_id);
    expect(snap?.retrieval_method).toBe("import");
    expect(snap?.source_policy_decision).toBe("allowed");
    expect(snap?.raw_text).toBe(AD.rawText);
  });

  it("re-discovering the same ad dedupes (no second canonical row)", async () => {
    const again = await importDiscovered(session, AD, "Adzuna");
    expect(again.created).toBe(false);
  });
});
