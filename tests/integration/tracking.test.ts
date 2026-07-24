import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";
import {
  deleteTracking,
  listTracked,
  loadTracking,
  upsertTracking,
} from "@/lib/tracking/logic";
import { getOwnProfile, importDiscovered } from "@/lib/opportunity/logic";

// Integration proof: the tracking pipeline persistence — upsert (create + move
// stage), listTracked joins the opportunity title, delete untracks — through a
// REAL session (RLS in force). Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p8-tracking-${randomUUID()}@test.local`;
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
  sourceUrl: "https://www.adzuna.fr/land/ad/777",
  engagementType: "permanent",
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  rawText: "Data Engineer\nchez Nova SA\n\nSpark, Airflow.",
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

describe("opportunity tracking (through the DB, RLS)", () => {
  it("creates, moves through the pipeline, and lists with the offer title", async () => {
    await upsertTracking(session, profileId, {
      opportunityId,
      stage: "saved",
      note: "Repérée",
      followUpOn: null,
    });
    let stored = await loadTracking(session, profileId, opportunityId);
    expect(stored?.stage).toBe("saved");

    // Move to applied + set a follow-up (upsert on the unique pair).
    await upsertTracking(session, profileId, {
      opportunityId,
      stage: "applied",
      note: "Candidature envoyée",
      followUpOn: "2026-08-01",
    });
    stored = await loadTracking(session, profileId, opportunityId);
    expect(stored?.stage).toBe("applied");
    expect(stored?.followUpOn).toBe("2026-08-01");

    const tracked = await listTracked(session, profileId);
    expect(tracked).toHaveLength(1); // still one row (upsert, not stacked)
    expect(tracked[0].title).toBe("Data Engineer");
    expect(tracked[0].organization).toBe("Nova SA");
  });

  it("untracks (removes from the pipeline)", async () => {
    await deleteTracking(session, profileId, opportunityId);
    expect(await loadTracking(session, profileId, opportunityId)).toBeNull();
    expect(await listTracked(session, profileId)).toHaveLength(0);
  });
});
