/**
 * Centralized product-voice copy (CONVERSATION_FRAMEWORK.md §Writing).
 * French default, English supported — a plain typed object keyed by locale,
 * NOT an i18n framework (deliberately deferred). This keeps conversational
 * strings out of the components; a real i18n solution is a later decision.
 */

export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";

export const copy = {
  fr: {
    cardStates: {
      proposed: "proposé",
      confirmed: "confirmé",
      needs_review: "à revoir",
      rejected: "ignoré",
    },
    actions: {
      confirm: "Confirmer",
      correct: "Corriger",
      ignore: "Ignorer",
      goDeeper: "Approfondir",
      viewScore: "Voir le score",
      compare: "Comparer",
      save: "Enregistrer",
      retry: "Réessayer",
      approve: "Approuver et exporter",
      decline: "Annuler",
      send: "Envoyer",
      restore: "Restaurer",
    },
    composer: {
      placeholder: "Écrivez votre réponse…",
      label: "Votre message",
    },
    context: {
      title: "Ce que MissionPilot a compris",
      progress: (pct: number) => `Profil complété à ${pct} %`,
    },
    error: {
      analyze: "Je n'ai pas pu analyser ce texte à l'instant.",
      retained: "Votre message est conservé.",
    },
    approval: {
      reassure: "MissionPilot ne fait rien sans votre accord.",
      blockedReason:
        "Approbation impossible : une affirmation n'est pas vérifiée.",
    },
    verdicts: {
      strong_match: "Correspondance forte",
      possible_match: "Correspondance possible",
      low_priority: "Priorité faible",
      do_not_apply: "Ne pas postuler",
      needs_review: "À revoir",
    },
    hardConstraint: {
      pass: "conforme",
      warn: "à vérifier",
      fail: "non conforme",
    },
  },
  en: {
    cardStates: {
      proposed: "proposed",
      confirmed: "confirmed",
      needs_review: "needs review",
      rejected: "ignored",
    },
    actions: {
      confirm: "Confirm",
      correct: "Correct",
      ignore: "Ignore",
      goDeeper: "Go deeper",
      viewScore: "View score",
      compare: "Compare",
      save: "Save",
      retry: "Retry",
      approve: "Approve and export",
      decline: "Cancel",
      send: "Send",
      restore: "Restore",
    },
    composer: {
      placeholder: "Write your reply…",
      label: "Your message",
    },
    context: {
      title: "What MissionPilot understood",
      progress: (pct: number) => `Profile ${pct}% complete`,
    },
    error: {
      analyze: "I couldn't analyze that just now.",
      retained: "Your message is kept.",
    },
    approval: {
      reassure: "MissionPilot does nothing without your go-ahead.",
      blockedReason: "Approval blocked: a claim is unverified.",
    },
    verdicts: {
      strong_match: "Strong match",
      possible_match: "Possible match",
      low_priority: "Low priority",
      do_not_apply: "Do not apply",
      needs_review: "Needs review",
    },
    hardConstraint: { pass: "pass", warn: "warn", fail: "fail" },
  },
} as const;

export function t(locale: Locale = DEFAULT_LOCALE) {
  return copy[locale];
}
