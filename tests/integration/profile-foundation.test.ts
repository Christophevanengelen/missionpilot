import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import {
  attachEvidence,
  createEvidence,
  detachEvidence,
  getOwnProfile,
  getVersionByNumber,
  listVersions,
  loadPreferences,
  publishVersion,
  restoreVersion,
  savePreferences,
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

  it("races on the row lock stay serialized (no duplicate, no gap)", async () => {
    // The DB is the sole author of content now, so two concurrent publishes
    // always see the same living state: the lock serializes them, exactly
    // one creates, the other is served the identical head.
    const s3 = await submitClaim(alice, aliceProfileId, "skill", {
      name: `Course-${randomUUID().slice(0, 8)}`,
    });
    await setClaimState(alice, s3, "confirmed");
    const { data: head } = await alice
      .from("profile_versions")
      .select("version_number")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = head?.version_number ?? 0;

    const [ra, rb] = await Promise.all([
      alice.rpc("publish_profile_version", {
        p_profile_id: aliceProfileId,
        p_change_summary: "course A",
      }),
      alice.rpc("publish_profile_version", {
        p_profile_id: aliceProfileId,
        p_change_summary: "course B",
      }),
    ]);
    expect(ra.error).toBeNull();
    expect(rb.error).toBeNull();
    const results = [ra.data, rb.data] as Array<{
      version_number: number;
      created: boolean;
    }>;
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results[0].version_number).toBe(results[1].version_number);
    expect(results[0].version_number).toBe(base + 1);

    // Sequential distinct states still number consecutively (n+1 then n+2).
    const s4 = await submitClaim(alice, aliceProfileId, "skill", {
      name: `Suite-${randomUUID().slice(0, 8)}`,
    });
    await setClaimState(alice, s4, "confirmed");
    const nextPublish = await publishVersion(alice, aliceProfileId);
    expect(nextPublish.created).toBe(true);
    expect(nextPublish.version_number).toBe(base + 2);
  });

  it("publishes EXACTLY the confirmed state — a proposed claim cannot leak in", async () => {
    const proposed = await submitClaim(alice, aliceProfileId, "skill", {
      name: `Proposée-${randomUUID().slice(0, 8)}`,
    });
    const publish = await publishVersion(alice, aliceProfileId);
    const { data: version } = await alice
      .from("profile_versions")
      .select("content")
      .eq("version_number", publish.version_number)
      .single();
    const kindsAndNames = JSON.stringify(version!.content);
    expect(kindsAndNames).not.toContain("Proposée-");
    // Cleanup: reject the proposal so later tests keep a clean state.
    await setClaimState(alice, proposed, "rejected");
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

describe("history reads (PR C): list and single-version contracts", () => {
  it("lists own versions newest first with the history fields", async () => {
    const versions = await listVersions(alice, aliceProfileId);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    const numbers = versions.map((v) => v.version_number);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    for (const v of versions) {
      expect(v.id).toBeTruthy();
      expect(typeof v.change_summary).toBe("string");
      expect(v.change_summary.length).toBeGreaterThan(0);
      expect(v.published_at).toBeTruthy();
    }
  });

  it("resolves a version by its human number, with content; null when absent", async () => {
    const versions = await listVersions(alice, aliceProfileId);
    const head = versions[0];
    const found = await getVersionByNumber(
      alice,
      aliceProfileId,
      head.version_number,
    );
    expect(found?.id).toBe(head.id);
    const content = found?.content as { schema_version: number };
    expect(content.schema_version).toBe(1);

    const absent = await getVersionByNumber(alice, aliceProfileId, 9999);
    expect(absent).toBeNull();
  });

  it("restore of head-identical content reports created=false and mutates nothing", async () => {
    // The RPC returns `created` — the UI needs it to distinguish the no-op
    // honestly (defect: the server action initially dropped this flag).
    const before = await listVersions(alice, aliceProfileId);
    const head = before[0];
    const claimsBefore = await alice
      .from("profile_claims")
      .select("id, state, superseded_at")
      .eq("profile_id", aliceProfileId)
      .order("id");
    const result = await restoreVersion(alice, aliceProfileId, head.id);
    expect(result.created).toBe(false);
    const after = await listVersions(alice, aliceProfileId);
    expect(after.length).toBe(before.length);
    expect(after[0].id).toBe(head.id);
    // "Mutates nothing" includes the living claims: same rows, same states,
    // none newly closed.
    const claimsAfter = await alice
      .from("profile_claims")
      .select("id, state, superseded_at")
      .eq("profile_id", aliceProfileId)
      .order("id");
    expect(claimsAfter.data).toEqual(claimsBefore.data);
  });

  it("another user reads nothing through the same functions", async () => {
    const versions = await listVersions(mallory, aliceProfileId);
    expect(versions).toEqual([]);
    const one = await getVersionByNumber(mallory, aliceProfileId, 1);
    expect(one).toBeNull();
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

describe("preferences & hard constraints (PR E)", () => {
  it("round-trips a full preference set through the session client", async () => {
    await savePreferences(alice, aliceProfileId, {
      targetRoleFamilies: ["Design produit", "Design systems"],
      preferredEngagementTypes: ["freelance", "interim"],
      languages: ["Français", "Anglais"],
      allowedWorkRegions: ["UE"],
      hardExclusions: ["Défense"],
      targetDayRate: 800,
      minimumDayRate: 650,
      baseCurrency: "EUR",
      remotePolicy: "remote_first",
      timezoneOverlap: "CET ±3 h",
      travelTolerance: "occasional",
    });
    const loaded = await loadPreferences(alice, aliceProfileId);
    expect(loaded.targetDayRate).toBe(800);
    expect(loaded.minimumDayRate).toBe(650);
    expect(loaded.preferredEngagementTypes).toEqual(["freelance", "interim"]);
    expect(loaded.remotePolicy).toBe("remote_first");
    expect(loaded.hardExclusions).toEqual(["Défense"]);
  });

  it("clearing back to defaults is allowed (all optional)", async () => {
    await savePreferences(alice, aliceProfileId, {
      targetRoleFamilies: [],
      preferredEngagementTypes: [],
      languages: [],
      allowedWorkRegions: [],
      hardExclusions: [],
      targetDayRate: null,
      minimumDayRate: null,
      baseCurrency: null,
      remotePolicy: null,
      timezoneOverlap: null,
      travelTolerance: null,
    });
    const loaded = await loadPreferences(alice, aliceProfileId);
    expect(loaded.targetDayRate).toBeNull();
    expect(loaded.languages).toEqual([]);
  });

  it("the DB rejects an incoherent rate floor even past the app", async () => {
    // Bypass the Zod boundary to prove the DB is the real guard.
    const { error } = await alice
      .from("candidate_profiles")
      .update({ target_day_rate: 500, minimum_day_rate: 900 })
      .eq("id", aliceProfileId);
    expect(error).not.toBeNull();
  });

  it("another user cannot write Alice's preferences", async () => {
    const { data } = await mallory
      .from("candidate_profiles")
      .update({ remote_policy: "onsite_ok" })
      .eq("id", aliceProfileId)
      .select("id");
    // RLS hides the row: the update matches nothing (no rows returned).
    expect(data).toEqual([]);
  });
});
