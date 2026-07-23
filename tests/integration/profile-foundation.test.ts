import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import {
  attachEvidence,
  createEvidence,
  detachEvidence,
  getOwnProfile,
  publishVersion,
  restoreVersion,
  setClaimState,
  submitClaim,
} from "@/lib/profile/logic";

// Integration proofs for the PR A data foundation, exercised through REAL
// authenticated sessions (RLS in force — the admin client is used only to
// provision/clean the synthetic user). Requires `supabase start`.

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

const alicePassword = `synthetic-${randomUUID()}`;
const aliceEmail = `p1a-alice-${randomUUID()}@test.local`;
const malloryPassword = `synthetic-${randomUUID()}`;
const malloryEmail = `p1a-mallory-${randomUUID()}@test.local`;

let aliceId: string;
let malloryId: string;
let alice: ReturnType<typeof sessionClient>;
let mallory: ReturnType<typeof sessionClient>;
let aliceProfileId: string;

beforeAll(async () => {
  for (const [email, password] of [
    [aliceEmail, alicePassword],
    [malloryEmail, malloryPassword],
  ] as const) {
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
  const a = await alice.auth.signInWithPassword({
    email: aliceEmail,
    password: alicePassword,
  });
  if (a.error) throw new Error(`alice sign-in failed: ${a.error.message}`);

  mallory = sessionClient();
  const m = await mallory.auth.signInWithPassword({
    email: malloryEmail,
    password: malloryPassword,
  });
  if (m.error) throw new Error(`mallory sign-in failed: ${m.error.message}`);

  aliceProfileId = (await getOwnProfile(alice)).id;
});

afterAll(async () => {
  // Synthetic users only — profile data cascades.
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (malloryId) await admin.auth.admin.deleteUser(malloryId);
});

describe("claims: explicit correction chain", () => {
  it("replaces a single-valued claim atomically and keeps the chain", async () => {
    const first = await submitClaim(alice, aliceProfileId, "role", {
      title: "Product Designer",
    });
    const corrected = await submitClaim(alice, aliceProfileId, "role", {
      title: "Lead Product Designer",
    });
    expect(corrected).not.toBe(first);

    const { data } = await alice
      .from("profile_claims")
      .select("id, state, previous_claim_id, superseded_by_claim_id")
      .eq("kind", "role");
    const byId = new Map(data!.map((c) => [c.id, c]));
    expect(byId.get(first)!.superseded_by_claim_id).toBe(corrected);
    expect(byId.get(corrected)!.previous_claim_id).toBe(first);
    // The old claim keeps its own state — `rejected` is never hijacked to
    // mean "replaced".
    expect(byId.get(first)!.state).toBe("proposed");
  });

  it("enforces the state machine at the application boundary", async () => {
    const claim = await submitClaim(alice, aliceProfileId, "skill", {
      name: "UX",
    });
    await setClaimState(alice, claim, "confirmed");
    await expect(setClaimState(alice, claim, "rejected")).rejects.toThrow(
      /illegal claim transition/,
    );
  });
});

describe("publication: atomic, idempotent, serialized", () => {
  it("double submit of identical content yields one version", async () => {
    const skill = await submitClaim(alice, aliceProfileId, "skill", {
      name: "Design system",
    });
    await setClaimState(alice, skill, "confirmed");

    const firstPublish = await publishVersion(alice, aliceProfileId);
    expect(firstPublish.created).toBe(true);

    const retry = await publishVersion(alice, aliceProfileId);
    expect(retry.created).toBe(false);
    expect(retry.version_number).toBe(firstPublish.version_number);

    const { count } = await alice
      .from("profile_versions")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(firstPublish.version_number);
  });

  it("a racing double submit of the SAME content creates exactly one row", async () => {
    const s2 = await submitClaim(alice, aliceProfileId, "skill", {
      name: `Accessibilité-${randomUUID().slice(0, 8)}`,
    });
    await setClaimState(alice, s2, "confirmed");
    const clientB = sessionClient();
    await clientB.auth.signInWithPassword({
      email: aliceEmail,
      password: alicePassword,
    });

    // Both sessions build the same living state → same content raced: one
    // creation wins, the loser is served the idempotent head — never two
    // rows, never a unique-violation error.
    const [r1, r2] = await Promise.all([
      publishVersion(alice, aliceProfileId),
      publishVersion(clientB as typeof alice, aliceProfileId),
    ]);
    const created = [r1, r2].filter((r) => r.created);
    expect(created).toHaveLength(1);
    expect(r1.version_number).toBe(r2.version_number);
  });

  it("serializes concurrent DIFFERENT contents into n+1 then n+2", async () => {
    const { data: head } = await alice
      .from("profile_versions")
      .select("version_number")
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    const base = head!.version_number;

    // Two direct RPC publishes with genuinely different contents race for
    // the profile-row lock: both must land, as consecutive numbers, with no
    // gap and no duplicate.
    const contentA = {
      schema_version: 1,
      claims: [{ kind: "skill", value: { name: "course-A" }, evidence: [] }],
    };
    const contentB = {
      schema_version: 1,
      claims: [{ kind: "skill", value: { name: "course-B" }, evidence: [] }],
    };
    const [ra, rb] = await Promise.all([
      alice.rpc("publish_profile_version", {
        p_profile_id: aliceProfileId,
        p_content: contentA,
        p_content_hash: "a".repeat(64),
        p_change_summary: "course A",
      }),
      alice.rpc("publish_profile_version", {
        p_profile_id: aliceProfileId,
        p_content: contentB,
        p_content_hash: "b".repeat(64),
        p_change_summary: "course B",
      }),
    ]);
    expect(ra.error).toBeNull();
    expect(rb.error).toBeNull();
    const numbers = [ra.data, rb.data]
      .map((d) => (d as { version_number: number }).version_number)
      .sort((x, y) => x - y);
    expect(numbers).toEqual([base + 1, base + 2]);
  });
});

describe("evidence + restore", () => {
  it("restores an old snapshot as a NEW traceable version with links", async () => {
    const achievement = await submitClaim(
      alice,
      aliceProfileId,
      "achievement",
      {
        title: "Refonte du checkout",
      },
    );
    await setClaimState(alice, achievement, "confirmed");
    const evidenceId = await createEvidence(alice, aliceProfileId, {
      type: "achievement",
      title: "Refonte du checkout — e-commerce",
      statement: "+18 % de conversion en six mois.",
      metrics: {},
      tags: [],
      sourceType: "user_stated",
      verificationStatus: "user_confirmed",
    });
    await alice
      .from("evidence_items")
      .update({ state: "confirmed" })
      .eq("id", evidenceId);
    const linkId = await attachEvidence(alice, achievement, evidenceId);

    const withEvidence = await publishVersion(alice, aliceProfileId);
    expect(withEvidence.created).toBe(true);

    // Move on: detach the evidence and publish a leaner head.
    await detachEvidence(alice, linkId, "réorganisation");
    const leaner = await publishVersion(alice, aliceProfileId);
    expect(leaner.created).toBe(true);

    // Restore the evidence-backed snapshot.
    const { data: source } = await alice
      .from("profile_versions")
      .select("id, version_number")
      .eq("version_number", withEvidence.version_number)
      .single();
    const restored = await restoreVersion(alice, aliceProfileId, source!.id);
    expect(restored.version_number).toBe(leaner.version_number + 1);
    expect(restored.missing_evidence).toBe(0);

    const { data: restoredVersion } = await alice
      .from("profile_versions")
      .select("created_from_version_id, change_summary")
      .eq("version_number", restored.version_number)
      .single();
    expect(restoredVersion!.created_from_version_id).toBe(source!.id);
    expect(restoredVersion!.change_summary).toBe(
      `Restauration de la version ${withEvidence.version_number}.`,
    );

    // The living state mirrors the snapshot again: the link is back.
    const { data: activeLinks } = await alice
      .from("claim_evidence_links")
      .select("id, detached_at")
      .is("detached_at", null);
    expect(activeLinks!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("isolation: another user is fully locked out", () => {
  it("cannot read, write, publish or restore Alice's data", async () => {
    const { data: claims } = await mallory
      .from("profile_claims")
      .select("id")
      .eq("profile_id", aliceProfileId);
    expect(claims).toEqual([]);

    const insert = await mallory.from("profile_claims").insert({
      profile_id: aliceProfileId,
      kind: "skill",
      value: { name: "intrusion" },
    });
    expect(insert.error).not.toBeNull();

    const publish = await mallory.rpc("publish_profile_version", {
      p_profile_id: aliceProfileId,
      p_content: { schema_version: 1, claims: [] },
      p_content_hash: "9".repeat(64),
      p_change_summary: "intrusion",
    });
    expect(publish.error).not.toBeNull();

    const { data: versions } = await mallory
      .from("profile_versions")
      .select("id")
      .eq("profile_id", aliceProfileId);
    expect(versions).toEqual([]);
  });
});
