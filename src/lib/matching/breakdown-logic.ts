/**
 * Testable persistence + freshness for the per-requirement match breakdown.
 * No "use server" here so the action stays a thin orchestrator and integration
 * tests exercise the exact production logic through a real session client.
 * The dossier/offer text builders and the input-hash live in insight-logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { MatchBreakdown } from "./ai-breakdown";

type Client = SupabaseClient<Database>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export type BreakdownRequirement = {
  text: string;
  importance: "must" | "nice";
  status: "covered" | "partial" | "missing";
  evidence: string;
  suggestion: string;
};

export type StoredBreakdown = {
  summary: string;
  requirements: BreakdownRequirement[];
  needs_review: boolean;
  input_hash: string;
};

/** The live breakdown of one opportunity, or null (RLS: own rows only). */
export async function loadBreakdown(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<StoredBreakdown | null> {
  const { data, error } = await client
    .from("ai_match_breakdowns")
    .select("summary, requirements, needs_review, input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("breakdown load", error.message);
  if (!data) return null;
  return {
    summary: data.summary,
    requirements: (data.requirements as BreakdownRequirement[]) ?? [],
    needs_review: data.needs_review,
    input_hash: data.input_hash,
  };
}

/** True when the stored breakdown already covers this exact (dossier, offer)
 *  pair — re-checked before spending to avoid a redundant LLM call. */
export async function isBreakdownFresh(
  client: Client,
  profileId: string,
  opportunityId: string,
  inputHash: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("ai_match_breakdowns")
    .select("input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("breakdown freshness", error.message);
  return data?.input_hash === inputHash;
}

/** Store/refresh the ONE live breakdown of the opportunity (upsert on the
 *  unique pair — a refresh replaces, never stacks). */
export async function upsertBreakdown(
  client: Client,
  profileId: string,
  opportunityId: string,
  breakdown: MatchBreakdown,
  inputHash: string,
): Promise<void> {
  const { error } = await client.from("ai_match_breakdowns").upsert(
    {
      profile_id: profileId,
      opportunity_id: opportunityId,
      summary: breakdown.summary,
      requirements: breakdown.requirements,
      needs_review: breakdown.needsReview,
      model: breakdown.model,
      prompt_version: breakdown.promptVersion,
      input_hash: inputHash,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("breakdown upsert", error.message);
}
