/**
 * Opportunity ingestion operations, parameterized by a SESSION-scoped
 * Supabase client (RLS owner policies always in force). Pure of Next.js
 * request context so integration tests exercise the exact production logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getOwnProfile } from "@/lib/profile/logic";
import {
  canonicalFingerprint,
  contentHash,
  extractFromPastedText,
} from "./extract";

type Client = SupabaseClient<Database>;

const PARSER_VERSION = "paste-extract-1";

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`);
}

/**
 * Import pasted source text: normalize deterministically, then atomically
 * create-or-touch the canonical opportunity AND its immutable snapshot via
 * the SECURITY DEFINER RPC. Returns the ids + whether a new canonical row
 * was created (vs. a duplicate that only appended a snapshot).
 */
export async function importPastedText(client: Client, rawText: string) {
  const { normalized, unknowns } = extractFromPastedText(rawText);
  const fingerprint = canonicalFingerprint(normalized);
  const hash = contentHash(rawText);

  const { data, error } = await client.rpc("import_opportunity", {
    p_canonical_fingerprint: fingerprint,
    p_content_hash: hash,
    p_raw_text: rawText,
    p_retrieval_method: "paste",
    p_parser_version: PARSER_VERSION,
    p_source_policy_decision: "allowed",
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
      source_name: normalized.sourceName,
      source_url: normalized.sourceUrl,
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

/** The caller's own opportunities, most-recently-seen first. */
export async function listOpportunities(client: Client, profileId: string) {
  const { data, error } = await client
    .from("opportunities")
    .select(
      "id, title, organization, engagement_type, seniority, remote_type, location_text, status, last_seen_at",
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
