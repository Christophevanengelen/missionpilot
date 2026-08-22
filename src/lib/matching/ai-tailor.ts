import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import type { AiUsage } from "@/lib/ai/types";
import { createLogger } from "@/lib/observability/logger";
import type { SupportedLanguage } from "./language";
import { DEFAULT_TONE_VOICE, type ToneVoice } from "./tone-contract";

/**
 * AI application tailoring ("préparer ma candidature") — for ONE offer, draft
 * a cover letter, a subject line and the ranked matching highlights, GROUNDED
 * in the user's VALIDATED profile. This is the "prepare, don't send" engine:
 * the output is a DRAFT the human reviews, edits and sends themselves; it is
 * never submitted automatically.
 *
 * Apply Pack L3: the letter and subject are written in the OPPORTUNITY's own
 * language (`language`, resolved deterministically in code from the
 * opportunity's own text — never the profile's default, never hardcoded
 * French), following the profile's own tone contract (`toneVoice`, resolved
 * from its latest version or the generic default when none exists yet — see
 * tone-contract.ts). The anti-cliché style guardrail runs AFTER this call, in
 * the caller (tailor-actions.ts) — this module only accepts an optional
 * `correctionNote` to drive the caller's single bounded regeneration retry.
 *
 * Honesty / anti-hallucination: the model must not invent experience, numbers
 * or credentials, and must not keyword-stuff — the subject line is bound by
 * the exact same rule as the letter, never a generic template. Where a
 * quantified result would strengthen the letter, it inserts an explicit
 * bracketed placeholder for the user to fill with a TRUE figure — never a
 * fabricated one.
 *
 * Graceful degradation: without the OpenAI provider this returns `null` and
 * the feature is simply unavailable — no error, no cost.
 */

export const APPLICATION_TAILOR_PROMPT_VERSION = "application-tailor-3";
const MAX_DOSSIER_CHARS = 8_000;
const MAX_OFFER_CHARS = 12_000;
const MAX_VARIANTS = 12;
const MAX_CORRECTION_NOTE_CHARS = 500;

/** A CV variant offered to the model — the name is the selection key the
 *  model must echo back exactly. */
export type OfferedCvVariant = {
  name: string;
  headline: string;
  useWhen: string;
};

const tailorSchema = z
  .object({
    /** A short, specific subject line (never a generic template) in the SAME
     *  language as coverLetter, grounded in the same profile/offer evidence
     *  and bound by the same no-invented-claims rule. */
    subject: z.string().trim().min(1).max(200),
    /** A ready-to-edit cover letter, first person, grounded in the profile,
     *  in the opportunity's own language; bracketed [placeholders] mark
     *  metrics the user must supply. */
    coverLetter: z.string().trim().min(1).max(4000),
    /** Ranked matching highlights (why this profile fits this offer). */
    highlights: z.array(z.string().trim().min(1).max(300)).max(8),
    /** Exactly one of the offered CV variant names, or null when the offered
     *  list was empty — never an invented name. */
    cvVariantName: z.string().trim().min(1).max(120).nullable(),
    /** One or two sentences, in the letter's own language, justifying the
     *  chosen variant against THIS offer, from the variant's own "use when"
     *  rules; null whenever cvVariantName is null. */
    cvVariantRationale: z.string().trim().min(1).max(1000).nullable(),
  })
  .strict();

export type ApplicationTailorAnalysis = z.infer<typeof tailorSchema>;

export type ApplicationDraft = ApplicationTailorAnalysis & {
  needsReview: boolean;
  model: string;
  promptVersion: string;
  /** Token usage and estimated cost of THIS call, as computed by the
   *  provider (ENGINEERING_PRINCIPLES.md §13 — cost is observable for every
   *  model call). Threaded through so a caller that makes more than one call
   *  for the same draft (tailor-actions.ts's bounded guardrail retry) can
   *  attribute and log the combined cost of both attempts, instead of that
   *  information being visible only in two unrelated per-call provider log
   *  lines. */
  usage: AiUsage;
};

const log = createLogger({ module: "application-tailor-ai" });

export function aiTailorConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/** Everything the model needs to write in the RIGHT language and voice —
 *  resolved deterministically by the caller before this function is ever
 *  invoked (language.ts + tone-contract.ts), never guessed here. */
export type TailorVoiceOptions = {
  /** The opportunity's own detected language — never the profile's default,
   *  never hardcoded. Defaults to "fr" (today's only observed behavior). */
  language?: SupportedLanguage;
  /** The profile's resolved tone contract for `language` (its own latest
   *  version, or the generic default). Defaults to the generic FR default. */
  toneVoice?: ToneVoice;
  /** Set only on the caller's single bounded regeneration retry, after the
   *  style guardrail rejected the first draft — a deterministic, concrete
   *  instruction naming the offending phrases (style-guardrail.ts). */
  correctionNote?: string | null;
};

/**
 * A tailored application draft, or `null` when AI is not configured or the
 * call fails.
 */
export async function aiTailorApplication(
  dossier: string,
  offerText: string,
  cvVariants: OfferedCvVariant[] = [],
  voice: TailorVoiceOptions = {},
): Promise<ApplicationDraft | null> {
  if (!aiTailorConfigured()) return null;
  const language = voice.language ?? "fr";
  const toneVoice = voice.toneVoice ?? DEFAULT_TONE_VOICE[language];
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "application-tailor",
      promptVersion: APPLICATION_TAILOR_PROMPT_VERSION,
      taskInstruction:
        "Prépare une candidature pour l'offre (inputData.offre) à partir du profil VALIDÉ du candidat (inputData.profil). Écris TOUT — coverLetter ET subject — dans la langue indiquée par inputData.langue ('fr' ou 'en'), jamais par défaut en français : c'est la langue de l'OFFRE, pas celle du profil. (1) coverLetter — une lettre de motivation à la première personne, prête à être relue et modifiée : accroche, adéquation profil/offre, valeur apportée, conclusion courtoise. Suis les règles de ton d'inputData.tonalite.regles (registre, longueur de phrase, ce qu'il faut éviter), et utilise sa formule d'appel (inputData.tonalite.appel) et sa formule de politesse finale (inputData.tonalite.formule_finale) ; si inputData.tonalite.signature contient un nom, signe avec ce nom, sinon laisse un marqueur entre crochets pour la signature. Ancre-toi UNIQUEMENT sur des éléments présents dans le profil. N'invente JAMAIS d'expérience, de chiffre, de diplôme ni de compétence. Là où un résultat chiffré renforcerait la lettre, insère un marqueur explicite entre crochets à compléter par le candidat, dans la langue de la lettre, ex. « [à compléter : ex. +30% de conversion / 5 clients grands comptes] » — jamais un chiffre inventé. Pas de bourrage de mots-clés, pas de formule toute faite ni de superlatif vide. (2) subject — un objet de message court (une phrase, 200 caractères maximum) dans la même langue, spécifique à CETTE offre et à ce profil — jamais un gabarit générique du type « Candidature » ou « Application » — et soumis aux mêmes règles d'honnêteté que la lettre : aucune affirmation ni aucun chiffre absent du profil. (3) highlights — 3 à 6 points de correspondance forts, chacun une phrase dans la langue de la lettre, justifiant l'adéquation, tirés du profil réel. (4) cvVariantName et cvVariantRationale — si inputData.variantes_cv contient des variantes de CV : choisis LA variante qui doit accompagner cette candidature, d'après leurs règles « quand » comparées à l'offre. cvVariantName = exactement l'un des noms listés, jamais un nom absent de la liste. cvVariantRationale = une à deux phrases, dans la langue de la lettre, qui justifient ce choix pour CETTE offre. Si inputData.variantes_cv est vide : cvVariantName = null et cvVariantRationale = null. Si aucune règle « quand » ne correspond réellement à l'offre, abstiens-toi : null pour les deux, plutôt qu'un choix forcé. Si inputData.consigne_correction contient un texte, c'est une correction OBLIGATOIRE sur un essai précédent rejeté pour son style : conforme-toi-y strictement, sans réintroduire les formules qu'elle cite. Le résultat est un BROUILLON que le candidat relit, ajuste et envoie lui-même — ne prétends jamais qu'il est envoyé.",
      input: {
        profil: dossier.slice(0, MAX_DOSSIER_CHARS),
        offre: offerText.slice(0, MAX_OFFER_CHARS),
        langue: language,
        tonalite: {
          regles: toneVoice.voiceRules.slice(0, 4000),
          appel: toneVoice.salutation.slice(0, 200),
          formule_finale: toneVoice.closing.slice(0, 200),
          signature: toneVoice.signatureName.slice(0, 200) || null,
        },
        variantes_cv: cvVariants.slice(0, MAX_VARIANTS).map((v) => ({
          nom: v.name.slice(0, 120),
          titre: v.headline.slice(0, 200),
          quand: v.useWhen.slice(0, 2000),
        })),
        consigne_correction: voice.correctionNote
          ? voice.correctionNote.slice(0, MAX_CORRECTION_NOTE_CHARS)
          : null,
      },
      dataSchema: tailorSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
      model: response.model,
      promptVersion: APPLICATION_TAILOR_PROMPT_VERSION,
      usage: response.usage,
    };
  } catch (error) {
    log.warn("application tailor unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
