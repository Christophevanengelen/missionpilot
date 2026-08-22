/**
 * Deterministic FR/EN language detection for an opportunity's own text
 * (ENGINEERING_PRINCIPLES.md §3, "deterministic before probabilistic" — this
 * is plain arithmetic on a stopword list, never a model call).
 *
 * The drafting workflow must write in the OPPORTUNITY's language, never the
 * profile's default and never hardcoded French (Apply Pack L3). This module
 * answers exactly one question: fr or en, from the listing's own title and
 * description. Ties and text with no signal default to "fr", by design —
 * that is today's observed behavior for every existing FR-only draft, and
 * this module must not regress it.
 *
 * No dependency exists anywhere in this repo for language detection (no
 * franc, no langdetect); a simple stopword classifier can misjudge short,
 * bilingual, or jargon-heavy listings. That residual risk is accepted and
 * recorded — the tie-break to "fr" is what keeps it from regressing existing
 * behavior, not a claim that every listing is classified correctly.
 */

export type SupportedLanguage = "fr" | "en";

// Short, high-frequency function words. Deliberately small and unambiguous —
// each list avoids words that plausibly appear as loanwords in the other
// language (e.g. no "manager", no "design").
const FR_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "et",
  "est",
  "sont",
  "pour",
  "dans",
  "avec",
  "sans",
  "vous",
  "nous",
  "votre",
  "vos",
  "notre",
  "nos",
  "chez",
  "sur",
  "par",
  "au",
  "aux",
  "ce",
  "cette",
  "ces",
  "qui",
  "que",
  "recherche",
  "recherchons",
  "expérience",
  "compétences",
  "ans",
  "être",
  "avoir",
  "poste",
  "équipe",
  "société",
  "entreprise",
  "mission",
  "années",
  "afin",
  "ainsi",
  "sein",
  "cadre",
  "travail",
  "connaissance",
]);

const EN_STOPWORDS = new Set([
  "the",
  "and",
  "is",
  "are",
  "for",
  "with",
  "without",
  "you",
  "your",
  "we",
  "our",
  "role",
  "company",
  "at",
  "of",
  "to",
  "in",
  "on",
  "this",
  "these",
  "who",
  "that",
  "looking",
  "seeking",
  "experience",
  "skills",
  "years",
  "be",
  "have",
  "team",
  "join",
  "about",
  "from",
  "will",
  "an",
  "as",
  "job",
  "work",
  "within",
]);

/** Unicode letters only (covers accented French characters). */
const WORD_PATTERN = /\p{L}+/gu;

/**
 * Detects the opportunity's own language from its title and description —
 * never from the candidate's profile, never hardcoded. A tie (including no
 * recognized stopword at all) resolves to "fr", preserving today's observed
 * behavior for every existing FR-only draft.
 */
export function detectOpportunityLanguage(
  title: string | null,
  description: string | null,
): SupportedLanguage {
  const text = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  const words = text.match(WORD_PATTERN) ?? [];
  let frScore = 0;
  let enScore = 0;
  for (const word of words) {
    if (FR_STOPWORDS.has(word)) frScore++;
    if (EN_STOPWORDS.has(word)) enScore++;
  }
  return enScore > frScore ? "en" : "fr";
}
