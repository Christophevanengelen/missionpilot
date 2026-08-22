/**
 * Tone-contract resolution: pure, deterministic logic (no DB access — that
 * lives in tailor-logic.ts's loadLatestToneContract, mirroring
 * loadCvVariants). Apply Pack L3: per-profile, versioned voice/tone rules
 * that the drafting workflow follows instead of a fixed hardcoded voice.
 *
 * A profile with no tone_contracts row yet must still draft correctly — this
 * module supplies a hardcoded, GENERIC default (FR and EN), never an
 * invented "founder voice". The founder's real 2026-08-17 campaign voice is
 * not in this repository; seeding a real tone_contracts row with it is a
 * separate human/product step (see
 * docs/loop-engineering/runs/APPLY-PACK-L3-contrat-de-ton.md), not something
 * this module fabricates.
 */
import type { SupportedLanguage } from "./language";

/** The tone-contract row shape this module resolves from — a subset of the
 *  `tone_contracts` table, kept narrow so callers can pass either a Supabase
 *  row or a hand-built test fixture. */
export type ToneContractRow = {
  voice_rules: string;
  signature_name: string;
  salutation_fr: string;
  salutation_en: string;
  closing_fr: string;
  closing_en: string;
  banned_phrases: string[];
};

/** The tone rules resolved for ONE language — what the drafting prompt and
 *  the guardrail actually consume. */
export type ToneVoice = {
  voiceRules: string;
  signatureName: string;
  salutation: string;
  closing: string;
};

/** Generic, hardcoded defaults — deliberately plain, never presented as
 *  anyone's real voice. Chosen to match today's OBSERVED default behavior
 *  for French (the existing model output already opens with something close
 *  to "Madame, Monsieur," and closes courteously) so a profile with no tone
 *  contract sees zero regression. */
export const DEFAULT_TONE_VOICE: Record<SupportedLanguage, ToneVoice> = {
  fr: {
    voiceRules:
      "Ton professionnel, direct et sobre. Phrases courtes. Aucun " +
      "superlatif vide (« passionné », « unique », « exceptionnel »). " +
      "Aucune formule toute faite. Rien n'est affirmé qui ne figure pas " +
      "dans le profil.",
    signatureName: "",
    salutation: "Madame, Monsieur,",
    closing: "Cordialement,",
  },
  en: {
    voiceRules:
      "Professional, direct, plain tone. Short sentences. No empty " +
      'superlatives ("passionate", "unique", "exceptional"). No stock ' +
      "phrases. Nothing stated beyond what the profile evidences.",
    signatureName: "",
    salutation: "Dear Hiring Manager,",
    closing: "Best regards,",
  },
};

/**
 * Resolves the tone voice to draft with, for ONE language: the profile's own
 * latest tone_contract row when one exists, the generic default otherwise.
 * Never mixes languages — the salutation/closing come from the row's field
 * matching `language`, not a hardcoded one.
 */
export function resolveToneVoice(
  contract: ToneContractRow | null,
  language: SupportedLanguage,
): ToneVoice {
  if (contract === null) return DEFAULT_TONE_VOICE[language];
  return {
    voiceRules: contract.voice_rules,
    signatureName: contract.signature_name,
    salutation:
      language === "fr" ? contract.salutation_fr : contract.salutation_en,
    closing: language === "fr" ? contract.closing_fr : contract.closing_en,
  };
}

/** The profile's own extra anti-cliché phrases — empty when there is no
 *  tone contract, never a guess at what the person would have banned. */
export function resolveBannedPhrases(
  contract: ToneContractRow | null,
): string[] {
  return contract?.banned_phrases ?? [];
}
