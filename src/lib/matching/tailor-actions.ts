"use server";

/**
 * On-demand application tailoring for ONE opportunity ("préparer ma
 * candidature" — cost-bounded to a single LLM call, freshness-aware). Produces
 * a DRAFT the human reviews and sends themselves; nothing is submitted. Honest
 * outcomes: a specific reason when it cannot run.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { getOpportunity, getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import {
  aiTailorConfigured,
  aiTailorApplication,
  type ApplicationDraft,
} from "./ai-tailor";
import {
  buildOfferText,
  buildProfileDossier,
  insightInputHash,
} from "./insight-logic";
import { detectOpportunityLanguage } from "./language";
import {
  buildCorrectionNote,
  checkStyleGuardrail,
  summarizeGuardrailRetryCost,
} from "./style-guardrail";
import {
  isDraftFresh,
  loadCvVariants,
  loadLatestToneContract,
  resolveChosenVariant,
  upsertDraft,
} from "./tailor-logic";
import { resolveBannedPhrases, resolveToneVoice } from "./tone-contract";

const logger = createLogger({ module: "tailor-actions" });

const inputSchema = z.object({ opportunityId: z.string().uuid() });

export type TailorRunResult =
  | { ok: true; fresh: boolean }
  | {
      ok: false;
      error: "unconfigured" | "no_profile" | "not_found" | "generic";
    };

/** One tailoring run per (profile, opportunity) at a time. Acquire the lock
 *  BEFORE recording it, so a busy short-circuit never releases another run's
 *  lock (the finally is a no-op while lockKey is null). */
const runsInFlight = new Set<string>();

export async function tailorApplicationAction(
  input: unknown,
): Promise<TailorRunResult> {
  let lockKey: string | null = null;
  try {
    const { opportunityId } = inputSchema.parse(input);
    await verifySession();
    if (!aiTailorConfigured()) return { ok: false, error: "unconfigured" };

    const client = await createClient();
    const profile = await getOwnProfile(client);

    const key = `${profile.id}:${opportunityId}`;
    if (runsInFlight.has(key)) return { ok: true, fresh: true };
    runsInFlight.add(key);
    lockKey = key;

    const opportunity = await getOpportunity(client, opportunityId);
    if (!opportunity || opportunity.profile_id !== profile.id) {
      return { ok: false, error: "not_found" };
    }

    const [living, preferences, cvVariants, toneContract] = await Promise.all([
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
      loadCvVariants(client, profile.id),
      loadLatestToneContract(client, profile.id),
    ]);
    const dossier = buildProfileDossier(living.claims, preferences);
    if (dossier === "") return { ok: false, error: "no_profile" };

    const offerText = buildOfferText({
      title: opportunity.title,
      organization: opportunity.organization,
      description: opportunity.description,
      skills: (opportunity.skills as string[]) ?? null,
      requirements: (opportunity.requirements as string[]) ?? null,
    });
    if (offerText.trim() === "") return { ok: false, error: "not_found" };

    // The language is read from the OPPORTUNITY's own text — never the
    // profile's default, never hardcoded (Apply Pack L3).
    const language = detectOpportunityLanguage(
      opportunity.title,
      opportunity.description,
    );
    const toneVoice = resolveToneVoice(toneContract, language);
    const bannedPhrases = resolveBannedPhrases(toneContract);

    // The CV variants and the tone contract are both part of the freshness
    // input: adding/renaming/rewording a variant, or publishing a new tone
    // contract version, must invalidate the stored draft. Both segments are
    // empty when there is nothing of the kind, which leaves the hash BYTE
    // IDENTICAL to the pre-L3 formula — no tone contract existing yet is the
    // overwhelmingly common case today, and it must not mass-invalidate every
    // existing FR draft (Apply Pack L3: zero regression). The control
    // separators assume no control characters in the user's own fields (to be
    // enforced at the variant/tone-contract write path); a collision would
    // only misjudge freshness, never corrupt data.
    const variantsText = cvVariants
      .map((v) => `${v.name}\x00${v.headline}\x00${v.use_when}`)
      .join("\x01");
    const toneText = toneContract
      ? [
          toneContract.id,
          toneContract.voice_rules,
          toneContract.signature_name,
          toneVoice.salutation,
          toneVoice.closing,
        ].join("\x00")
      : "";
    let combinedOffer = offerText;
    if (variantsText !== "")
      combinedOffer = `${combinedOffer}\x02${variantsText}`;
    if (toneText !== "") combinedOffer = `${combinedOffer}\x03${toneText}`;
    const inputHash = insightInputHash(dossier, combinedOffer);
    if (await isDraftFresh(client, profile.id, opportunityId, inputHash)) {
      return { ok: true, fresh: true };
    }

    const offeredVariants = cvVariants.map((v) => ({
      name: v.name,
      headline: v.headline,
      useWhen: v.use_when,
    }));

    const draft = await aiTailorApplication(
      dossier,
      offerText,
      offeredVariants,
      {
        language,
        toneVoice,
      },
    );
    if (draft === null) return { ok: false, error: "generic" };

    // Deterministic anti-cliché guardrail (style-guardrail.ts), enforced
    // BEFORE anything is persisted (ENGINEERING_PRINCIPLES.md §3, §5). At
    // most one bounded regeneration retry with a corrective instruction; if
    // the second attempt still violates it, the draft is stored anyway with
    // needsReview forced true — the human always gets something to edit,
    // never a silently "clean" draft that in fact tripped the guardrail.
    const finalDraft = await enforceStyleGuardrail(
      draft,
      bannedPhrases,
      async (correctionNote) =>
        aiTailorApplication(dossier, offerText, offeredVariants, {
          language,
          toneVoice,
          correctionNote,
        }),
    );

    // An unknown name from the model counts as "no choice" — never a guess.
    const chosen = resolveChosenVariant(cvVariants, finalDraft.cvVariantName);
    if (finalDraft.cvVariantName !== null && chosen === null) {
      logger.warn("model chose an unknown cv variant", {
        offered: cvVariants.length,
      });
    }
    await upsertDraft(
      client,
      profile.id,
      opportunityId,
      finalDraft,
      inputHash,
      chosen?.id ?? null,
      language,
      toneContract?.id ?? null,
    );
    try {
      revalidatePath(`/opportunities/${opportunityId}`);
    } catch (error) {
      logger.error("draft revalidation failed", {
        step: "revalidatePath",
        mutation: "committed",
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: true, fresh: false };
  } catch (error) {
    logger.error("tailor run failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false, error: "generic" };
  } finally {
    if (lockKey !== null) runsInFlight.delete(lockKey);
  }
}

/**
 * Runs the deterministic anti-cliché guardrail (style-guardrail.ts) on a
 * draft's cover letter and subject. Clean on the first try: returned as-is.
 * A violation: exactly ONE bounded regeneration retry with a corrective
 * instruction naming the offending phrases — never a loop
 * (STOP_CONDITIONS.md-style bound). If the retry itself fails to produce a
 * draft (provider hiccup), the ORIGINAL draft is kept rather than losing the
 * work, flagged for review. If the retry succeeds but still violates the
 * guardrail, that retried draft is stored anyway with needsReview forced
 * true — the human always gets something to edit, never a draft silently
 * shipped as "clean" when it in fact tripped the guardrail.
 *
 * `regenerate` performs the SAME cost-bounded LLM call as the first attempt
 * (aiTailorApplication → the provider), so each attempt individually gets
 * the same per-call cost/latency/token observability every model call
 * already gets (ENGINEERING_PRINCIPLES.md §13, openai-provider.ts). On top
 * of that, THIS function logs one explicit, combined-cost record whenever a
 * retry actually happens — attributing the doubled spend to the guardrail
 * decision that caused it, tokens and estimated cost of BOTH attempts
 * together, since two independent per-call provider log lines cannot be
 * told apart from an ordinary single-attempt draft without that link.
 */
async function enforceStyleGuardrail(
  draft: ApplicationDraft,
  extraBannedPhrases: readonly string[],
  regenerate: (correctionNote: string) => Promise<ApplicationDraft | null>,
): Promise<ApplicationDraft> {
  const violations = checkStyleGuardrail(
    { coverLetter: draft.coverLetter, subject: draft.subject },
    extraBannedPhrases,
  );
  if (violations.length === 0) return draft;

  logger.warn("style guardrail violation — regenerating once", {
    violations: violations.length,
  });
  const retry = await regenerate(buildCorrectionNote(violations));

  // Combined-cost record for this guardrail-triggered retry, logged
  // regardless of whether the retry itself succeeded — a failed retry
  // attempt still spent tokens and money that must be attributable to the
  // guardrail decision, not silently absorbed into an unrelated log line.
  // Pure summing lives in style-guardrail.ts (summarizeGuardrailRetryCost,
  // unit-tested) — this call site only logs the result.
  logger.info(
    "style guardrail retry cost",
    summarizeGuardrailRetryCost(draft.usage, retry?.usage ?? null),
  );

  if (retry === null) {
    return { ...draft, needsReview: true };
  }

  const retryViolations = checkStyleGuardrail(
    { coverLetter: retry.coverLetter, subject: retry.subject },
    extraBannedPhrases,
  );
  if (retryViolations.length > 0) {
    logger.warn("style guardrail violation persisted after regeneration", {
      violations: retryViolations.length,
    });
    return { ...retry, needsReview: true };
  }
  return retry;
}
