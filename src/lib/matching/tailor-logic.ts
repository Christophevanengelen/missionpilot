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
  subject: string | null;
  language: string;
  highlights: string[];
  needs_review: boolean;
  input_hash: string;
  cv_variant_id: string | null;
  cv_variant_rationale: string | null;
  tone_contract_id: string | null;
};

/** A profile's CV variant as offered to the tailoring model. */
export type CvVariantSummary = {
  id: string;
  name: string;
  headline: string;
  use_when: string;
};

/** The profile's CV variants (RLS: own rows only) — the menu the tailoring
 *  model chooses from. Ordered by name so the freshness fingerprint built
 *  from the list is deterministic. */
export async function loadCvVariants(
  client: Client,
  profileId: string,
): Promise<CvVariantSummary[]> {
  const { data, error } = await client
    .from("cv_variants")
    .select("id, name, headline, use_when")
    .eq("profile_id", profileId)
    .order("name");
  if (error) fail("cv variants load", error.message);
  return data ?? [];
}

/** A profile's tone contract row, as needed to resolve a ToneVoice
 *  (tone-contract.ts) and to record which exact version a draft was
 *  generated under. */
export type ToneContractSummary = {
  id: string;
  version: number;
  voice_rules: string;
  signature_name: string;
  salutation_fr: string;
  salutation_en: string;
  closing_fr: string;
  closing_en: string;
  banned_phrases: string[];
};

/** The profile's LATEST published tone contract (RLS: own rows only), or
 *  null when none has been published yet — the caller then drafts with the
 *  generic default (tone-contract.ts), never a guess. Versioning is
 *  append-only at the DB layer (no update/delete grant for authenticated):
 *  "latest" is simply the highest version number, never a row that could
 *  have been mutated in place. */
export async function loadLatestToneContract(
  client: Client,
  profileId: string,
): Promise<ToneContractSummary | null> {
  const { data, error } = await client
    .from("tone_contracts")
    .select(
      "id, version, voice_rules, signature_name, salutation_fr, salutation_en, closing_fr, closing_en, banned_phrases",
    )
    .eq("profile_id", profileId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("tone contract load", error.message);
  if (!data) return null;
  return { ...data, banned_phrases: (data.banned_phrases as string[]) ?? [] };
}

/** The variant the model actually chose, or null — an unknown name counts as
 *  "no choice", never a guess (the model may only echo an offered name). */
export function resolveChosenVariant<T extends { name: string }>(
  variants: readonly T[],
  chosenName: string | null,
): T | null {
  if (chosenName === null) return null;
  return variants.find((v) => v.name === chosenName) ?? null;
}

/** The live draft of one opportunity, or null (RLS: own rows only). */
export async function loadDraft(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<StoredDraft | null> {
  const { data, error } = await client
    .from("ai_application_drafts")
    .select(
      "cover_letter, subject, language, highlights, needs_review, input_hash, cv_variant_id, cv_variant_rationale, tone_contract_id",
    )
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("draft load", error.message);
  if (!data) return null;
  return {
    cover_letter: data.cover_letter,
    subject: data.subject,
    language: data.language,
    highlights: (data.highlights as string[]) ?? [],
    needs_review: data.needs_review,
    input_hash: data.input_hash,
    cv_variant_id: data.cv_variant_id,
    cv_variant_rationale: data.cv_variant_rationale,
    tone_contract_id: data.tone_contract_id,
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
 *  pair — a refresh replaces, never stacks).
 *
 *  `language` and `chosenToneContractId` default to "fr" / null — the exact
 *  values every pre-L3 call site already produced — so an existing caller
 *  that has not been updated for the tone contract keeps drafting exactly as
 *  before (Apply Pack L3: zero regression when no tone contract exists). */
export async function upsertDraft(
  client: Client,
  profileId: string,
  opportunityId: string,
  draft: ApplicationDraft,
  inputHash: string,
  chosenVariantId: string | null = null,
  language = "fr",
  chosenToneContractId: string | null = null,
): Promise<void> {
  const { error } = await client.from("ai_application_drafts").upsert(
    {
      profile_id: profileId,
      opportunity_id: opportunityId,
      cover_letter: draft.coverLetter,
      subject: draft.subject,
      language,
      highlights: draft.highlights,
      needs_review: draft.needsReview,
      model: draft.model,
      prompt_version: draft.promptVersion,
      input_hash: inputHash,
      cv_variant_id: chosenVariantId,
      // The DB trigger enforces this too: a rationale never travels without
      // its variant.
      cv_variant_rationale:
        chosenVariantId === null ? null : draft.cvVariantRationale,
      tone_contract_id: chosenToneContractId,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("draft upsert", error.message);
}
