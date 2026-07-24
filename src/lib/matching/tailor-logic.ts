/**
 * Testable persistence + freshness for the tailored application draft. No
 * "use server" here so the action stays a thin orchestrator and integration
 * tests exercise the exact production logic through a real session client. The
 * dossier/offer builders and the input-hash live in insight-logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ApplicationDraft } from "./ai-tailor";

type Client = SupabaseClient<Database>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export type StoredDraft = {
  cover_letter: string;
  highlights: string[];
  needs_review: boolean;
  input_hash: string;
};

/** The live draft of one opportunity, or null (RLS: own rows only). */
export async function loadDraft(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<StoredDraft | null> {
  const { data, error } = await client
    .from("ai_application_drafts")
    .select("cover_letter, highlights, needs_review, input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("draft load", error.message);
  if (!data) return null;
  return {
    cover_letter: data.cover_letter,
    highlights: (data.highlights as string[]) ?? [],
    needs_review: data.needs_review,
    input_hash: data.input_hash,
  };
}

/** True when the stored draft already covers this exact (dossier, offer) pair
 *  — re-checked before spending to avoid a redundant LLM call. */
export async function isDraftFresh(
  client: Client,
  profileId: string,
  opportunityId: string,
  inputHash: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("ai_application_drafts")
    .select("input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("draft freshness", error.message);
  return data?.input_hash === inputHash;
}

/** Store/refresh the ONE live draft of the opportunity (upsert on the unique
 *  pair — a refresh replaces, never stacks). */
export async function upsertDraft(
  client: Client,
  profileId: string,
  opportunityId: string,
  draft: ApplicationDraft,
  inputHash: string,
): Promise<void> {
  const { error } = await client.from("ai_application_drafts").upsert(
    {
      profile_id: profileId,
      opportunity_id: opportunityId,
      cover_letter: draft.coverLetter,
      highlights: draft.highlights,
      needs_review: draft.needsReview,
      model: draft.model,
      prompt_version: draft.promptVersion,
      input_hash: inputHash,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("draft upsert", error.message);
}
