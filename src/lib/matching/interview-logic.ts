/**
 * Testable persistence + freshness for the interview-preparation brief. No
 * "use server" here so the action stays a thin orchestrator and integration
 * tests exercise the exact production logic through a real session client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { InterviewBrief } from "./ai-interview";

type Client = SupabaseClient<Database>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export type BriefQuestion = { question: string; angle: string };

export type StoredBrief = {
  questions: BriefQuestion[];
  talkingPoints: string[];
  needs_review: boolean;
  input_hash: string;
};

/** The live brief of one opportunity, or null (RLS: own rows only). */
export async function loadBrief(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<StoredBrief | null> {
  const { data, error } = await client
    .from("ai_interview_briefs")
    .select("questions, talking_points, needs_review, input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("brief load", error.message);
  if (!data) return null;
  return {
    questions: (data.questions as BriefQuestion[]) ?? [],
    talkingPoints: (data.talking_points as string[]) ?? [],
    needs_review: data.needs_review,
    input_hash: data.input_hash,
  };
}

/** True when the stored brief already covers this exact (dossier, offer) pair. */
export async function isBriefFresh(
  client: Client,
  profileId: string,
  opportunityId: string,
  inputHash: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("ai_interview_briefs")
    .select("input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("brief freshness", error.message);
  return data?.input_hash === inputHash;
}

/** Store/refresh the ONE live brief (upsert — a refresh replaces, never
 *  stacks). */
export async function upsertBrief(
  client: Client,
  profileId: string,
  opportunityId: string,
  brief: InterviewBrief,
  inputHash: string,
): Promise<void> {
  const { error } = await client.from("ai_interview_briefs").upsert(
    {
      profile_id: profileId,
      opportunity_id: opportunityId,
      questions: brief.questions,
      talking_points: brief.talkingPoints,
      needs_review: brief.needsReview,
      model: brief.model,
      prompt_version: brief.promptVersion,
      input_hash: inputHash,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("brief upsert", error.message);
}
