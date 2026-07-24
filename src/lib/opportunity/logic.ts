/**
 * Opportunity ingestion operations, parameterized by a SESSION-scoped
 * Supabase client (RLS owner policies always in force). Pure of Next.js
 * request context so integration tests exercise the exact production logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  NORMALIZED_FIELDS,
  normalizedOpportunitySchema,
} from "@/domain/opportunity";
import { getOwnProfile } from "@/lib/profile/logic";
import {
  canonicalFingerprint,
  contentHash,
  extractFromPastedText,
} from "./extract";
import { classifySource } from "./source-policy";

type Client = SupabaseClient<Database>;

const PARSER_VERSION = "paste-extract-1";

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`);
}

type ImportSource = {
  retrievalMethod: "paste" | "url" | "import";
  sourcePolicyDecision: "allowed" | "manual_only";
  /** Provenance overrides (URL import records where the text came from). */
  sourceUrl?: string | null;
  sourceName?: string | null;
};

/**
 * Normalize pasted text and atomically create-or-touch the canonical
 * opportunity + its immutable snapshot via the SECURITY DEFINER RPC. The
 * `source` describes provenance (paste, or a policy-gated URL). Returns the
 * ids + whether a new canonical row was created (vs. a duplicate that only
 * appended a snapshot) + the honest unknowns.
 */
async function runImport(
  client: Client,
  rawText: string,
  source: ImportSource,
  /** Prepared extraction (discovery merges structured source fields); when
   *  omitted the deterministic extractor runs on `rawText`. */
  prepared?: ReturnType<typeof extractFromPastedText>,
) {
  const { normalized, unknowns } = prepared ?? extractFromPastedText(rawText);
  const fingerprint = canonicalFingerprint(normalized);
  const hash = contentHash(rawText);

  const { data, error } = await client.rpc("import_opportunity", {
    p_canonical_fingerprint: fingerprint,
    p_content_hash: hash,
    p_raw_text: rawText,
    p_retrieval_method: source.retrievalMethod,
    p_parser_version: PARSER_VERSION,
    p_source_policy_decision: source.sourcePolicyDecision,
    p_normalized: {
      title: normalized.title,
      organization: normalized.organization,
      engagement_type: normalized.engagementType,
      seniority: normalized.seniority,
      description: normalized.description,
      requirements: normalized.requirements,
      responsibilities: normalized.responsibilities,
      skills: normalized.skills,
      location_text: normalized.locationText,
      remote_type: normalized.remoteType,
      compensation_min: normalized.compensationMin,
      compensation_max: normalized.compensationMax,
      compensation_currency: normalized.compensationCurrency,
      compensation_period: normalized.compensationPeriod,
      source_name: source.sourceName ?? normalized.sourceName,
      source_url: source.sourceUrl ?? normalized.sourceUrl,
    },
  });
  if (error) fail("import", error.message);
  const result = data as {
    opportunity_id: string;
    snapshot_id: string;
    created: boolean;
  };
  return { ...result, unknowns };
}

/** Import pasted source text (no stated origin). */
export async function importPastedText(client: Client, rawText: string) {
  return runImport(client, rawText, {
    retrievalMethod: "paste",
    sourcePolicyDecision: "allowed",
  });
}

/**
 * Import from a source URL: classify the URL by the source policy, then — for
 * an accepted (manual_only) source — record it as provenance and normalize
 * the user-pasted text. No server-side fetch happens (owner decision); a
 * blocked URL throws a typed reason the action maps to an honest message.
 */
export async function importFromUrl(
  client: Client,
  url: string,
  rawText: string,
) {
  const policy = classifySource(url);
  if (policy.decision === "blocked") {
    fail("source policy", `blocked:${policy.reason}`);
  }
  return runImport(client, rawText, {
    retrievalMethod: "url",
    sourcePolicyDecision: "manual_only",
    sourceUrl: url.trim(),
    sourceName: policy.host,
  });
}

/**
 * Import an AUTO-DISCOVERED ad (legal source connector, e.g. Adzuna). The
 * source's structured fields take precedence over what the deterministic
 * extractor reads from the ad text (they come typed from the API); everything
 * the source did not state stays honestly null. Same pipeline as every other
 * import: immutable snapshot, per-owner dedup by canonical fingerprint,
 * gate + score computed on read.
 */
export async function importDiscovered(
  client: Client,
  ad: import("@/lib/discovery/adzuna").DiscoveredAd,
  sourceName: string,
) {
  const base = extractFromPastedText(ad.rawText);
  const adHasSalary =
    ad.compensationMin !== null || ad.compensationMax !== null;
  const merged: typeof base.normalized = {
    ...base.normalized,
    title: ad.title?.slice(0, 500) ?? base.normalized.title,
    organization:
      ad.organization?.slice(0, 300) ?? base.normalized.organization,
    description: ad.description?.slice(0, 20000) ?? base.normalized.description,
    locationText:
      ad.locationText?.slice(0, 300) ?? base.normalized.locationText,
    engagementType: ad.engagementType ?? base.normalized.engagementType,
    // The compensation block is taken WHOLE from one side — mixing an API
    // figure with an extractor currency/period would fabricate a claim.
    compensationMin: adHasSalary
      ? ad.compensationMin
      : base.normalized.compensationMin,
    compensationMax: adHasSalary
      ? ad.compensationMax
      : base.normalized.compensationMax,
    compensationCurrency: adHasSalary
      ? ad.compensationCurrency
      : base.normalized.compensationCurrency,
    compensationPeriod: adHasSalary
      ? ad.compensationPeriod
      : base.normalized.compensationPeriod,
  };
  // Local invariant enforcement: the merged shape must satisfy the SAME
  // contract as extractor output (bounds, comp coherence) — a violation fails
  // THIS ad here, not deep in the RPC.
  const normalized = normalizedOpportunitySchema.parse(merged);
  const unknowns = NORMALIZED_FIELDS.filter((f) => {
    const v = normalized[f];
    return v === null || (Array.isArray(v) && v.length === 0);
  });
  return runImport(
    client,
    ad.rawText,
    {
      retrievalMethod: "import",
      sourcePolicyDecision: "allowed",
      sourceUrl: ad.sourceUrl?.slice(0, 2000) ?? null,
      sourceName,
    },
    { normalized, unknowns },
  );
}

/** The caller's own opportunities, most-recently-seen first. */
export async function listOpportunities(client: Client, profileId: string) {
  const { data, error } = await client
    .from("opportunities")
    .select(
      "id, title, organization, engagement_type, seniority, remote_type, location_text, status, last_seen_at, description, skills, requirements, responsibilities, compensation_min, compensation_max, compensation_currency, compensation_period",
    )
    .eq("profile_id", profileId)
    .order("last_seen_at", { ascending: false });
  if (error) fail("opportunities list", error.message);
  return data;
}

/** One opportunity with all normalized fields (RLS: own rows only). */
export async function getOpportunity(client: Client, opportunityId: string) {
  const { data, error } = await client
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) fail("opportunity read", error.message);
  return data;
}

/**
 * How many immutable snapshots this opportunity has (RLS: own rows only).
 * Equals the number of times the listing was imported — one snapshot per
 * retrieval — so it is the truthful "seen N times" count. A `head` count
 * fetches no rows.
 */
export async function countSnapshots(client: Client, opportunityId: string) {
  const { count, error } = await client
    .from("opportunity_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);
  if (error) fail("snapshot count", error.message);
  return count ?? 0;
}

/** The most recent immutable source snapshot for an opportunity. */
export async function getLatestSnapshot(client: Client, opportunityId: string) {
  const { data, error } = await client
    .from("opportunity_snapshots")
    .select(
      "id, retrieval_method, retrieved_at, content_hash, raw_text, parser_version, source_policy_decision",
    )
    .eq("opportunity_id", opportunityId)
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("snapshot read", error.message);
  return data;
}

export { getOwnProfile };
