import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import { createLogger } from "@/lib/observability/logger";

/**
 * AI interview-preparation brief — the last link of the premium cycle
 * (discover → match → prepare → apply → track → INTERVIEW → offer). For ONE
 * offer, the model drafts the questions this employer is likely to ask,
 * each mapped to the candidate's REAL evidence, plus talking points grounded
 * in the validated profile.
 *
 * Honesty: preparation material, never a script of fabricated claims and
 * never a promise about the outcome. The model must not invent experience,
 * numbers or employer facts; where a metric would strengthen an answer it
 * inserts a bracketed placeholder for the candidate to fill truthfully.
 *
 * Graceful degradation: without the OpenAI provider this returns `null`.
 */

export const INTERVIEW_BRIEF_PROMPT_VERSION = "interview-brief-1";
const MAX_DOSSIER_CHARS = 8_000;
const MAX_OFFER_CHARS = 12_000;

const briefSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            /** A question this employer is likely to ask, in French. */
            question: z.string().trim().min(1).max(300),
            /** How to answer FROM THE REAL PROFILE — the evidence to use. */
            angle: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      // At least one question: an all-empty brief would persist, render blank
      // and become unregenerable (freshness would short-circuit forever).
      .min(1)
      .max(12),
    /** Points to raise proactively, grounded in the profile. */
    talkingPoints: z.array(z.string().trim().min(1).max(300)).max(8),
  })
  .strict();

export type InterviewBriefAnalysis = z.infer<typeof briefSchema>;

export type InterviewBrief = InterviewBriefAnalysis & {
  needsReview: boolean;
  model: string;
  promptVersion: string;
};

const log = createLogger({ module: "interview-brief-ai" });

export function aiInterviewConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/** An interview brief, or `null` when AI is not configured or the call fails. */
export async function aiInterviewBrief(
  dossier: string,
  offerText: string,
): Promise<InterviewBrief | null> {
  if (!aiInterviewConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "interview-brief",
      promptVersion: INTERVIEW_BRIEF_PROMPT_VERSION,
      taskInstruction:
        "Prépare l'entretien pour l'offre (inputData.offre) à partir du profil VALIDÉ du candidat (inputData.profil). (1) questions — 5 à 8 questions que ce recruteur posera vraisemblablement, en français, ancrées sur les exigences RÉELLEMENT énoncées dans l'offre ; pour chacune, 'angle' explique comment y répondre EN S'APPUYANT sur des éléments présents dans le profil (l'expérience précise à citer). (2) talkingPoints — 3 à 5 points à amener proactivement, tirés du profil réel. N'invente JAMAIS d'expérience, de chiffre, de diplôme, ni de fait sur l'entreprise. Là où un résultat chiffré renforcerait une réponse, insère un marqueur entre crochets à compléter par le candidat, ex. « [à compléter : ex. équipe de N personnes] ». Ne promets aucun résultat : c'est de la préparation, pas une garantie.",
      input: {
        profil: dossier.slice(0, MAX_DOSSIER_CHARS),
        offre: offerText.slice(0, MAX_OFFER_CHARS),
      },
      dataSchema: briefSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
      model: response.model,
      promptVersion: INTERVIEW_BRIEF_PROMPT_VERSION,
    };
  } catch (error) {
    log.warn("interview brief unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
