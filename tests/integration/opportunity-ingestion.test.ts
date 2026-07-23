import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import {
  getLatestSnapshot,
  getOpportunity,
  getOwnProfile,
  importPastedText,
  listOpportunities,
} from "@/lib/opportunity/logic";

// Integration proofs for Phase 2 ingestion through REAL authenticated
// sessions (RLS in force; the admin client only provisions/cleans users).
// Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const aliceEmail = `p2-alice-${randomUUID()}@test.local`;
const malloryEmail = `p2-mallory-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;

let aliceId: string;
let malloryId: string;
let alice: ReturnType<typeof sessionClient>;
let mallory: ReturnType<typeof sessionClient>;
let aliceProfileId: string;

const LISTING = `Staff Backend Engineer
chez Globex

Location: Berlin
Hybrid

TJM: 700 €/jour

Skills:
- Go
- Postgres`;

beforeAll(async () => {
  for (const email of [aliceEmail, malloryEmail]) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(`fixture user failed: ${created.error?.message}`);
    }
    if (email === aliceEmail) aliceId = created.data.user.id;
    else malloryId = created.data.user.id;
  }

  alice = sessionClient();
  await alice.auth.signInWithPassword({ email: aliceEmail, password });
  mallory = sessionClient();
  await mallory.auth.signInWithPassword({ email: malloryEmail, password });
  aliceProfileId = (await getOwnProfile(alice)).id;
});

afterAll(async () => {
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (malloryId) await admin.auth.admin.deleteUser(malloryId);
});

describe("pasted-text import", () => {
  it("creates a normalized opportunity + frozen snapshot from the source", async () => {
    const result = await importPastedText(alice, LISTING);
    expect(result.created).toBe(true);

    const opp = await getOpportunity(alice, result.opportunity_id);
    expect(opp?.title).toBe("Staff Backend Engineer");
    expect(opp?.organization).toBe("Globex");
    expect(opp?.remote_type).toBe("hybrid");
    expect(opp?.compensation_min).toBe(700);
    expect(opp?.skills).toEqual(["Go", "Postgres"]);

    const snap = await getLatestSnapshot(alice, result.opportunity_id);
    expect(snap?.raw_text).toBe(LISTING);
    expect(snap?.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap?.retrieval_method).toBe("paste");
  });

  it("re-importing the same listing dedupes and appends a snapshot", async () => {
    const first = await importPastedText(alice, LISTING);
    expect(first.created).toBe(false); // already imported above

    const { count } = await alice
      .from("opportunity_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", first.opportunity_id);
    expect(count ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("honestly reports unknown fields for opaque text", async () => {
    const result = await importPastedText(
      alice,
      "just some prose with no structure",
    );
    expect(result.unknowns).toContain("organization");
    expect(result.unknowns).toContain("skills");
  });

  it("another user reads none of Alice's opportunities", async () => {
    const list = await listOpportunities(mallory, aliceProfileId);
    expect(list).toEqual([]);
  });
});
