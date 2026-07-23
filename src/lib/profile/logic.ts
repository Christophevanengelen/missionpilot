/**
 * Profile/evidence operations, parameterized by a SESSION-scoped Supabase
 * client — RLS owner policies are always in force here (this vertical never
 * uses the admin client). Pure of Next.js request context so integration
 * tests exercise the exact production logic (same pattern as
 * workflows/health-logic.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  assertClaimTransition,
  parseClaimValue,
  SINGLE_VALUED_KINDS,
  type ClaimKind,
  type ClaimState,
  type EvidenceInput,
} from "@/domain/profile";
import { buildVersionContent, type VersionContent } from "./version-content";
import { buildChangeSummary, buildRestoreSummary } from "./change-summary";

type Client = SupabaseClient<Database>;

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`);
}

export async function getOwnProfile(client: Client) {
  const { data, error } = await client
    .from("candidate_profiles")
    .select("id, display_name, current_version_id")
    .single();
  if (error) fail("profile", error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Claims

/**
 * Propose a claim. Single-valued kinds atomically close the previous active
 * claim (SQL function, single transaction); multi-valued kinds only close a
 * claim when an explicit correction target is given.
 */
export async function submitClaim(
  client: Client,
  profileId: string,
  kind: ClaimKind,
  rawValue: unknown,
  opts: { origin?: "user" | "assistant"; claimToSupersede?: string } = {},
) {
  const value = parseClaimValue(kind, rawValue);
  if (
    opts.claimToSupersede === undefined &&
    !SINGLE_VALUED_KINDS.includes(kind)
  ) {
    const { data, error } = await client
      .from("profile_claims")
      .insert({
        profile_id: profileId,
        kind,
        value,
        origin: opts.origin ?? "user",
      })
      .select("id")
      .single();
    if (error) fail("claim insert", error.message);
    return data.id;
  }
  const { data, error } = await client.rpc("replace_profile_claim", {
    p_profile_id: profileId,
    p_kind: kind,
    p_value: value,
    p_origin: opts.origin ?? "user",
    p_claim_to_supersede: opts.claimToSupersede,
  });
  if (error) fail("claim replace", error.message);
  return data as string;
}

/** Confirm / flag / reject / restore a claim, via the domain state machine. */
export async function setClaimState(
  client: Client,
  claimId: string,
  to: ClaimState,
) {
  const { data: current, error: readError } = await client
    .from("profile_claims")
    .select("state, superseded_at")
    .eq("id", claimId)
    .single();
  if (readError) fail("claim read", readError.message);
  if (current.superseded_at) fail("claim state", "claim is closed");
  assertClaimTransition(current.state as ClaimState, to);

  const { data, error } = await client
    .from("profile_claims")
    .update({ state: to })
    .eq("id", claimId)
    .eq("state", current.state) // optimistic: no lost concurrent decision
    .select("id")
    .maybeSingle();
  if (error) fail("claim update", error.message);
  if (!data) fail("claim update", "state changed concurrently — retry");
  return data.id;
}

// ---------------------------------------------------------------------------
// Evidence

function evidenceRow(profileId: string, input: EvidenceInput) {
  return {
    profile_id: profileId,
    type: input.type,
    title: input.title,
    statement: input.statement,
    organization: input.organization ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    metrics: input.metrics,
    tags: input.tags,
    source_type: input.sourceType,
    source_reference: input.sourceReference ?? null,
    verification_status: input.verificationStatus,
  };
}

export async function createEvidence(
  client: Client,
  profileId: string,
  input: EvidenceInput,
) {
  const { data, error } = await client
    .from("evidence_items")
    .insert(evidenceRow(profileId, input))
    .select("id")
    .single();
  if (error) fail("evidence insert", error.message);
  return data.id;
}

export async function updateEvidence(
  client: Client,
  evidenceId: string,
  input: EvidenceInput,
) {
  const { profile_id: _ignored, ...columns } = evidenceRow("", input);
  void _ignored;
  const { data, error } = await client
    .from("evidence_items")
    .update(columns)
    .eq("id", evidenceId)
    .select("id")
    .maybeSingle();
  if (error) fail("evidence update", error.message);
  if (!data) fail("evidence update", "not found or not owned");
  return data.id;
}

export async function setEvidenceState(
  client: Client,
  evidenceId: string,
  to: ClaimState,
) {
  const { data: current, error: readError } = await client
    .from("evidence_items")
    .select("state")
    .eq("id", evidenceId)
    .single();
  if (readError) fail("evidence read", readError.message);
  assertClaimTransition(current.state as ClaimState, to);
  const { data, error } = await client
    .from("evidence_items")
    .update({ state: to })
    .eq("id", evidenceId)
    .eq("state", current.state)
    .select("id")
    .maybeSingle();
  if (error) fail("evidence state", error.message);
  if (!data) fail("evidence state", "state changed concurrently — retry");
  return data.id;
}

export async function attachEvidence(
  client: Client,
  claimId: string,
  evidenceId: string,
) {
  const { data, error } = await client
    .from("claim_evidence_links")
    .insert({ claim_id: claimId, evidence_id: evidenceId })
    .select("id")
    .single();
  if (error) fail("link insert", error.message);
  return data.id;
}

/** Detaching stamps the link (traceable) — it never deletes history. */
export async function detachEvidence(
  client: Client,
  linkId: string,
  reason?: string,
) {
  const { data, error } = await client
    .from("claim_evidence_links")
    .update({
      detached_at: new Date().toISOString(),
      detach_reason: reason ?? null,
    })
    .eq("id", linkId)
    .is("detached_at", null)
    .select("id")
    .maybeSingle();
  if (error) fail("link detach", error.message);
  if (!data) fail("link detach", "not found, not owned or already detached");
  return data.id;
}

// ---------------------------------------------------------------------------
// Living state + publication

export async function loadLivingProfile(client: Client, profileId: string) {
  const [claims, evidence] = await Promise.all([
    client
      .from("profile_claims")
      .select("id, kind, value, state, origin, previous_claim_id, created_at")
      .eq("profile_id", profileId)
      .is("superseded_at", null)
      .order("created_at", { ascending: true }),
    client
      .from("evidence_items")
      .select(
        "id, type, title, statement, organization, start_date, end_date, metrics, tags, source_type, source_reference, verification_status, state",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true }),
  ]);
  if (claims.error) fail("claims load", claims.error.message);
  if (evidence.error) fail("evidence load", evidence.error.message);

  const claimIds = claims.data.map((c) => c.id);
  const links = claimIds.length
    ? await client
        .from("claim_evidence_links")
        .select("id, claim_id, evidence_id")
        .in("claim_id", claimIds)
        .is("detached_at", null)
    : { data: [], error: null };
  if (links.error) fail("links load", links.error.message);

  return { claims: claims.data, evidence: evidence.data, links: links.data };
}

/**
 * Snapshot of what the profile ASSERTS today: confirmed claims, with their
 * actively-linked, confirmed evidence embedded.
 */
export async function buildPublishableContent(
  client: Client,
  profileId: string,
): Promise<VersionContent> {
  const { claims, evidence, links } = await loadLivingProfile(
    client,
    profileId,
  );
  const confirmedClaims = claims.filter((c) => c.state === "confirmed");
  const confirmedEvidence = evidence.filter((e) => e.state === "confirmed");
  const confirmedEvidenceIds = new Set(confirmedEvidence.map((e) => e.id));
  const activeLinks = links.filter(
    (l) =>
      confirmedClaims.some((c) => c.id === l.claim_id) &&
      confirmedEvidenceIds.has(l.evidence_id),
  );
  return buildVersionContent(
    confirmedClaims.map((c) => ({
      id: c.id,
      kind: c.kind,
      value: c.value as Record<string, unknown>,
    })),
    activeLinks,
    confirmedEvidence,
  );
}

export async function publishVersion(client: Client, profileId: string) {
  const next = await buildPublishableContent(client, profileId);

  const { data: profile, error: profileError } = await client
    .from("candidate_profiles")
    .select("current_version_id")
    .eq("id", profileId)
    .single();
  if (profileError) fail("profile read", profileError.message);

  let previous: VersionContent | null = null;
  if (profile.current_version_id) {
    const { data: head, error: headError } = await client
      .from("profile_versions")
      .select("content")
      .eq("id", profile.current_version_id)
      .single();
    if (headError) fail("head version read", headError.message);
    previous = head.content as VersionContent;
  }

  const summary = buildChangeSummary(previous, next);
  // Option B (owner arbitration): the DATABASE rebuilds the snapshot
  // canonically from the confirmed living state inside the locked
  // transaction — the app only WORDS the human summary and never supplies
  // content. Accepted drift: this unlocked preview may miss a concurrent
  // same-user change that lands before the lock; the stored content is
  // always the DB truth, the summary is descriptive only.
  const { data, error } = await client.rpc("publish_profile_version", {
    p_profile_id: profileId,
    p_change_summary: summary,
  });
  if (error) fail("publish", error.message);
  const result = data as {
    version_id: string;
    version_number: number;
    created: boolean;
  };
  return { ...result, summary };
}

export async function restoreVersion(
  client: Client,
  profileId: string,
  versionId: string,
) {
  const { data: source, error: sourceError } = await client
    .from("profile_versions")
    .select("version_number")
    .eq("id", versionId)
    .single();
  if (sourceError) fail("restore read", sourceError.message);

  const { data, error } = await client.rpc("restore_profile_version", {
    p_profile_id: profileId,
    p_version_id: versionId,
    p_change_summary: buildRestoreSummary(source.version_number),
  });
  if (error) fail("restore", error.message);
  return data as {
    version_id: string;
    version_number: number;
    created: boolean;
    missing_evidence: number;
  };
}
