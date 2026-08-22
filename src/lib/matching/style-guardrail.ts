/**
 * Deterministic anti-cliché / style guardrail (Apply Pack L3,
 * ENGINEERING_PRINCIPLES.md §3, "deterministic before probabilistic"). Plain
 * substring matching against a fixed FR + EN phrase list, extendable per
 * profile by the tone contract's own `banned_phrases`. Runs on the generated
 * cover letter AND subject BEFORE the caller ever persists a draft — it is
 * the enforcement mechanism, not a suggestion the model can ignore.
 *
 * The built-in lists below are generic, industry-standard clichés authored
 * for this loop (e.g. "passionate self-starter", "je me permets de vous
 * contacter") — NOT derived from the founder's real 2026-08-17 campaign
 * voice, which is not in this repository. Seeding a real tone contract with
 * that actual corpus is a separate, human-driven step (see
 * docs/loop-engineering/runs/APPLY-PACK-L3-contrat-de-ton.md).
 */

/** Generic French cover-letter clichés. */
export const DEFAULT_BANNED_PHRASES_FR: readonly string[] = [
  "je me permets de vous contacter",
  "passionné de longue date",
  "passionnée de longue date",
  "n'hésitez pas à me contacter",
  "de par ma formation",
  "force de proposition",
  "esprit d'équipe développé",
  "excellent relationnel",
  "polyvalent et dynamique",
  "autonome et rigoureux",
  "autonome et rigoureuse",
  "à l'écoute et bienveillant",
];

/** Generic English cover-letter clichés. */
export const DEFAULT_BANNED_PHRASES_EN: readonly string[] = [
  "passionate self-starter",
  "team player",
  "proven track record",
  "results-driven professional",
  "hit the ground running",
  "think outside the box",
  "detail-oriented and self-motivated",
  "excellent communication skills",
  "dynamic and versatile",
  "go-getter",
  "synergy",
  "wear many hats",
];

/** Token usage + estimated cost of one model call, as returned by the
 *  provider abstraction (`AiUsage` in @/lib/ai/types) — duplicated here as a
 *  minimal shape so this pure module needs no dependency on the AI layer. */
export type ModelCallUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export type GuardrailRetryCost = {
  /** Always 2 for this helper: it exists to attribute the SECOND call's
   *  cost, which only happens after a guardrail violation triggers the
   *  bounded regeneration retry (tailor-actions.ts's enforceStyleGuardrail).
   *  A clean first draft never calls this — there was only one attempt. */
  attempts: 2;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  /** Whether the retry itself produced a usable draft (a provider failure on
   *  the retry still cost money and must not be silently unattributed —
   *  ENGINEERING_PRINCIPLES.md §13, "cost is observable for every model
   *  call"). */
  retrySucceeded: boolean;
};

/**
 * Sums the token usage/cost of a guardrail-triggered retry's two attempts
 * into ONE explicit, attributable record — so a draft that cost twice as
 * much because it tripped the style guardrail is distinguishable from an
 * ordinary single-attempt draft, instead of that fact being visible only in
 * two unrelated per-call provider log lines with no link between them.
 * `retry` is `null` when the regeneration call itself failed (provider
 * error/timeout) — its cost is then treated as zero because no usage figure
 * is available for a failed call, not because none was spent.
 */
export function summarizeGuardrailRetryCost(
  firstAttempt: ModelCallUsage,
  retry: ModelCallUsage | null,
): GuardrailRetryCost {
  const retryUsage = retry ?? {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
  };
  return {
    attempts: 2,
    totalInputTokens: firstAttempt.inputTokens + retryUsage.inputTokens,
    totalOutputTokens: firstAttempt.outputTokens + retryUsage.outputTokens,
    totalCost: firstAttempt.estimatedCost + retryUsage.estimatedCost,
    retrySucceeded: retry !== null,
  };
}

export type GuardrailField = "coverLetter" | "subject";

export type GuardrailViolation = {
  field: GuardrailField;
  phrase: string;
};

/** Accent-insensitive, case-insensitive, whitespace-normalized comparison —
 *  a phrase must be recognizable regardless of straight quotes vs curly
 *  quotes or a double space, but this is still exact substring matching, not
 *  fuzzy scoring: it never "roughly" flags a phrase. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .replace(/[‘’]/g, "'") // curly single quotes -> straight
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks the generated cover letter and subject against the built-in FR + EN
 * cliché lists plus the profile's own extra banned phrases (from its tone
 * contract, if any). Returns every match found — empty when clean.
 */
export function checkStyleGuardrail(
  content: { coverLetter: string; subject: string },
  extraBannedPhrases: readonly string[] = [],
): GuardrailViolation[] {
  const phrases = [
    ...DEFAULT_BANNED_PHRASES_FR,
    ...DEFAULT_BANNED_PHRASES_EN,
    ...extraBannedPhrases,
  ]
    .map((p) => p.trim())
    .filter((p) => p !== "");

  const fields: { field: GuardrailField; value: string }[] = [
    { field: "coverLetter", value: content.coverLetter },
    { field: "subject", value: content.subject },
  ];

  const violations: GuardrailViolation[] = [];
  for (const { field, value } of fields) {
    const normalized = normalize(value);
    for (const phrase of phrases) {
      if (normalized.includes(normalize(phrase))) {
        violations.push({ field, phrase });
      }
    }
  }
  return violations;
}

/**
 * A deterministic, human-readable correction instruction listing exactly
 * which phrases were flagged — fed back to the model as
 * `consigne_correction` on the single bounded regeneration retry
 * (STOP_CONDITIONS.md-style bound: at most one retry, never a loop).
 */
export function buildCorrectionNote(
  violations: readonly GuardrailViolation[],
): string {
  const phrases = [...new Set(violations.map((v) => v.phrase))];
  return (
    "Le brouillon précédent contenait des formules interdites : " +
    `${phrases.map((p) => `« ${p} »`).join(", ")}. ` +
    "Réécris sans AUCUNE de ces formules, ni leur équivalent proche, en " +
    "gardant le même niveau d'exactitude factuelle."
  );
}
