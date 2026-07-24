import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import { createLogger } from "@/lib/observability/logger";

/**
 * AI "pourquoi ce match" — the honest LLM judgement layered ON TOP of the
 * deterministic gate + score (owner mandate: scored offers with a rationale).
 * The profile dossier and the ad text are DATA (the provider enforces the
 * prompt-injection boundary + strict envelope); the insight never overrides
 * the deterministic verdicts, it explains the match in human terms.
 *
 * Graceful degradation: without the OpenAI provider this returns `null` and
 * the inbox stays purely deterministic — no error, no cost.
 */

export const MATCH_INSIGHT_PROMPT_VERSION = "match-insight-1";
const MAX_DOSSIER_CHARS = 8_000;
const MAX_OFFER_CHARS = 12_000; // cost bound per analyzed offer

/** All fields REQUIRED per the strict-structured-outputs dataSchema contract;
 *  length bounds are enforced by this local gate only (stripped on the wire). */
const matchInsightSchema = z
  .object({
    /** strong only on a clear role+skills alignment; weak when it isn't one. */
    fit: z.enum(["strong", "good", "weak"]),
    /** 2-3 factual French sentences: WHY this level, citing only elements
     *  present in the profile and the offer. */
    rationale: z.string().trim().min(1).max(600),
    strengths: z.array(z.string().trim().min(1).max(200)).max(5),
    gaps: z.array(z.string().trim().min(1).max(200)).max(5),
  })
  .strict();

export type MatchInsightAnalysis = z.infer<typeof matchInsightSchema>;

/** The analysis plus the model's own uncertainty signal (shown to the user —
 *  an unsure judgement must never present itself as a sure one). */
export type MatchInsight = MatchInsightAnalysis & {
  needsReview: boolean;
  model: string;
  promptVersion: string;
};

const log = createLogger({ module: "match-insight-ai" });

export function aiInsightConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/**
 * One honest match judgement, or `null` when AI is not configured or the call
 * fails (the deterministic inbox stands alone — an AI failure must never
 * break it).
 */
export async function aiExplainMatch(
  dossier: string,
  offerText: string,
): Promise<MatchInsight | null> {
  if (!aiInsightConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "match-insight",
      promptVersion: MATCH_INSIGHT_PROMPT_VERSION,
      // Server-authored instruction on the TRUSTED side; the input carries
      // only the untrusted profile dossier + ad text.
      taskInstruction:
        "Compare le profil du candidat (inputData.profil) avec l'offre (inputData.offre) et juge honnêtement la correspondance. (1) fit — strong UNIQUEMENT si le rôle et les compétences clés correspondent clairement; good si la correspondance est réelle mais partielle; weak sinon. (2) rationale — 2 à 3 phrases en français, factuelles, expliquant POURQUOI ce niveau, en citant uniquement des éléments PRÉSENTS dans le profil et l'offre. (3) strengths — jusqu'à 5 forces du profil explicitement pertinentes pour cette offre. (4) gaps — jusqu'à 5 exigences de l'offre que le profil ne démontre pas. N'invente RIEN : une information absente n'est ni une force ni un acquis.",
      input: {
        profil: dossier.slice(0, MAX_DOSSIER_CHARS),
        offre: offerText.slice(0, MAX_OFFER_CHARS),
      },
      dataSchema: matchInsightSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
      model: response.model,
      promptVersion: MATCH_INSIGHT_PROMPT_VERSION,
    };
  } catch (error) {
    log.warn("match insight unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
