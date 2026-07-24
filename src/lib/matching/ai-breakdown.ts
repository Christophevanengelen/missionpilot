import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import { createLogger } from "@/lib/observability/logger";

/**
 * AI per-requirement match + gap analysis ("détail de correspondance") — the
 * premium deepening of the card-level "why this match". For ONE offer the
 * model extracts each stated requirement, classifies must-have vs nice-to-have,
 * marks it covered/partial/missing against the user's VALIDATED profile, links
 * the evidence, and proposes an HONEST upgrade suggestion for gaps (upskill or
 * truthful reframe — NEVER invent experience). It is a PROPOSAL on top of the
 * deterministic gate + score, not a substitute.
 *
 * Graceful degradation: without the OpenAI provider this returns `null` and
 * the deterministic score stands alone — no error, no cost.
 */

export const MATCH_BREAKDOWN_PROMPT_VERSION = "match-breakdown-1";
const MAX_DOSSIER_CHARS = 8_000;
const MAX_OFFER_CHARS = 12_000;

/** All fields REQUIRED (nullable, never optional) per the strict-structured
 *  -outputs contract; bounds enforced by this local gate only. */
const breakdownSchema = z
  .object({
    /** 1-2 factual French sentences framing the overall fit honestly. */
    summary: z.string().trim().min(1).max(1000),
    requirements: z
      .array(
        z
          .object({
            /** The requirement as stated in the offer, concise. */
            text: z.string().trim().min(1).max(300),
            importance: z.enum(["must", "nice"]),
            status: z.enum(["covered", "partial", "missing"]),
            /** For covered/partial: the profile element that proves it. For
             *  missing: a short note on the gap. Never fabricated. */
            evidence: z.string().trim().min(1).max(400),
            /** HONEST upgrade advice for partial/missing (upskill or truthful
             *  reframe). Empty string when covered or when there is nothing
             *  honest to suggest — never invent experience. */
            suggestion: z.string().trim().max(400),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export type MatchBreakdownAnalysis = z.infer<typeof breakdownSchema>;

export type MatchBreakdown = MatchBreakdownAnalysis & {
  needsReview: boolean;
  model: string;
  promptVersion: string;
};

const log = createLogger({ module: "match-breakdown-ai" });

export function aiBreakdownConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/**
 * The per-requirement breakdown, or `null` when AI is not configured or the
 * call fails (the deterministic score stands alone — a failure never breaks
 * the page).
 */
export async function aiMatchBreakdown(
  dossier: string,
  offerText: string,
): Promise<MatchBreakdown | null> {
  if (!aiBreakdownConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "match-breakdown",
      promptVersion: MATCH_BREAKDOWN_PROMPT_VERSION,
      taskInstruction:
        "Analyse la correspondance entre le profil du candidat (inputData.profil) et l'offre (inputData.offre), exigence par exigence. (1) summary — 1 à 2 phrases factuelles en français sur l'adéquation globale. (2) requirements — pour CHAQUE exigence réellement énoncée dans l'offre: text (l'exigence, concise), importance ('must' si indispensable, 'nice' si souhaitable), status ('covered' si le profil la démontre clairement, 'partial' si partiellement, 'missing' sinon), evidence (l'élément PRÉCIS du profil qui la prouve pour covered/partial, ou une courte note sur le manque pour missing — jamais inventé), suggestion (pour partial/missing UNIQUEMENT: un conseil HONNÊTE pour améliorer le CV — soit monter en compétence, soit reformuler une expérience réelle pour mieux la mettre en valeur; chaîne vide si covered ou si aucun conseil honnête n'existe). N'invente JAMAIS d'expérience, de chiffre ou de compétence absente. Ne suggère jamais de bourrage de mots-clés ni de texte caché. Base-toi uniquement sur ce qui est présent dans le profil et l'offre.",
      input: {
        profil: dossier.slice(0, MAX_DOSSIER_CHARS),
        offre: offerText.slice(0, MAX_OFFER_CHARS),
      },
      dataSchema: breakdownSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
      model: response.model,
      promptVersion: MATCH_BREAKDOWN_PROMPT_VERSION,
    };
  } catch (error) {
    log.warn("match breakdown unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
