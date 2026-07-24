import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import { createLogger } from "@/lib/observability/logger";

/**
 * AI application tailoring ("préparer ma candidature") — for ONE offer, draft
 * a French cover letter and the ranked matching highlights, GROUNDED in the
 * user's VALIDATED profile. This is the "prepare, don't send" engine: the
 * output is a DRAFT the human reviews, edits and sends themselves; it is never
 * submitted automatically.
 *
 * Honesty / anti-hallucination: the model must not invent experience, numbers
 * or credentials, and must not keyword-stuff. Where a quantified result would
 * strengthen the letter, it inserts an explicit bracketed placeholder for the
 * user to fill with a TRUE figure — never a fabricated one.
 *
 * Graceful degradation: without the OpenAI provider this returns `null` and
 * the feature is simply unavailable — no error, no cost.
 */

export const APPLICATION_TAILOR_PROMPT_VERSION = "application-tailor-1";
const MAX_DOSSIER_CHARS = 8_000;
const MAX_OFFER_CHARS = 12_000;

const tailorSchema = z
  .object({
    /** A ready-to-edit French cover letter, first person, grounded in the
     *  profile; bracketed [placeholders] mark metrics the user must supply. */
    coverLetter: z.string().trim().min(1).max(4000),
    /** Ranked matching highlights (why this profile fits this offer). */
    highlights: z.array(z.string().trim().min(1).max(300)).max(8),
  })
  .strict();

export type ApplicationTailorAnalysis = z.infer<typeof tailorSchema>;

export type ApplicationDraft = ApplicationTailorAnalysis & {
  needsReview: boolean;
  model: string;
  promptVersion: string;
};

const log = createLogger({ module: "application-tailor-ai" });

export function aiTailorConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/**
 * A tailored application draft, or `null` when AI is not configured or the
 * call fails.
 */
export async function aiTailorApplication(
  dossier: string,
  offerText: string,
): Promise<ApplicationDraft | null> {
  if (!aiTailorConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "application-tailor",
      promptVersion: APPLICATION_TAILOR_PROMPT_VERSION,
      taskInstruction:
        "Prépare une candidature pour l'offre (inputData.offre) à partir du profil VALIDÉ du candidat (inputData.profil). (1) coverLetter — une lettre de motivation en français, à la première personne, prête à être relue et modifiée : accroche, adéquation profil/offre, valeur apportée, conclusion courtoise. Ancre-toi UNIQUEMENT sur des éléments présents dans le profil. N'invente JAMAIS d'expérience, de chiffre, de diplôme ni de compétence. Là où un résultat chiffré renforcerait la lettre, insère un marqueur explicite entre crochets à compléter par le candidat, ex. « [à compléter : ex. +30% de conversion / 5 clients grands comptes] » — jamais un chiffre inventé. Pas de bourrage de mots-clés. (2) highlights — 3 à 6 points de correspondance forts, chacun une phrase, justifiant l'adéquation, tirés du profil réel. Le résultat est un BROUILLON que le candidat relit, ajuste et envoie lui-même — ne prétends jamais qu'il est envoyé.",
      input: {
        profil: dossier.slice(0, MAX_DOSSIER_CHARS),
        offre: offerText.slice(0, MAX_OFFER_CHARS),
      },
      dataSchema: tailorSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
      model: response.model,
      promptVersion: APPLICATION_TAILOR_PROMPT_VERSION,
    };
  } catch (error) {
    log.warn("application tailor unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
