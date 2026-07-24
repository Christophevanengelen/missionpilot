/**
 * Received recommendations → `testimonial` evidence (peer proof). Pure and
 * framework-free. The user PASTES a recommendation they received (LinkedIn,
 * email, …) — their own data, their own right to copy it. The app never
 * fetches or scrapes it, and never claims it is externally verified: provenance
 * is honestly `user_stated` + `user_confirmed`.
 */
import { z } from "zod";
import type { EvidenceInput } from "@/domain/profile";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** A verification link — an http(s) URL (e.g. the LinkedIn recommendation). */
const sourceUrl = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "L'URL doit commencer par http:// ou https://",
  });

export const recommendationInputSchema = z
  .object({
    /** Who wrote the recommendation. */
    recommender: trimmed(200),
    /** Their relationship to you (e.g. "Directeur, ex-manager"). */
    relationship: trimmed(200).optional(),
    /** Their organisation, if relevant. */
    organization: trimmed(200).optional(),
    /** The recommendation text, exactly as received. */
    text: trimmed(5000),
    /** Verification link so the recommendation can be traced back and trusted
     *  (e.g. the LinkedIn recommendation URL). Optional but encouraged. */
    sourceUrl: sourceUrl.optional(),
  })
  .strict();

export type RecommendationInput = z.infer<typeof recommendationInputSchema>;

/**
 * Map a received recommendation to a `testimonial` evidence item. The evidence
 * TYPE is fixed here (never taken from client input), so this path can only
 * ever create a testimonial. A verification link is kept as the source
 * reference (`url` provenance); without one it is honestly `user_stated`.
 */
export function buildTestimonialEvidence(
  input: RecommendationInput,
): EvidenceInput {
  return {
    type: "testimonial",
    title: input.recommender,
    statement: input.text,
    organization: input.organization,
    rolePlayed: input.relationship,
    metrics: {},
    tags: [],
    sourceType: input.sourceUrl ? "url" : "user_stated",
    sourceReference: input.sourceUrl,
    verificationStatus: "user_confirmed",
  };
}
