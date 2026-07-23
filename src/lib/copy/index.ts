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
    interview: {
      welcome:
        "Bonjour. Construisons ensemble votre profil professionnel — une question à la fois.",
      resume: "Reprenons. Voici où nous en étions.",
      understood: "Voici ce que j'ai compris — dites-moi si c'est juste.",
      questions: {
        role: "Quel rôle professionnel voulez-vous présenter en priorité ?",
        seniority:
          "Comment décririez-vous votre niveau de séniorité dans ce rôle ?",
        years_experience:
          "Combien d'années d'expérience portez-vous dans ce domaine ?",
        summary:
          "En quelques phrases, comment résumeriez-vous votre parcours ?",
        skill: "Quelle compétence clé voulez-vous mettre en avant ?",
        achievement:
          "Quelle réalisation concrète illustre le mieux votre valeur ?",
      },
      deepenQuestions: {
        role: "Précisons ce rôle : quel intitulé exact souhaitez-vous présenter, et pour quel type de missions ?",
        seniority:
          "Précisons : qu'est-ce qui caractérise concrètement ce niveau (portée, encadrement, autonomie) ?",
        years_experience:
          "Précisons ce chiffre : combien d'années comptez-vous sur ce cœur de métier précisément ?",
        summary:
          "Reformulons votre résumé : qu'est-ce qui vous distingue vraiment, en une ou deux phrases fortes ?",
        skill:
          "Précisons cette compétence : comment la nommeriez-vous pour qu'un client la reconnaisse immédiatement ?",
        achievement:
          "Précisons cette réalisation : quel était le contexte, et quel résultat mesurable en est sorti ?",
      },
      suggestEvidence: (title: string) =>
        `Voulez-vous appuyer « ${title} » par une preuve concrète ?`,
      complete:
        "Votre socle de profil est en place. Vous pouvez l'enrichir ou corriger ce qui a évolué.",
      pausedIncomplete: (done: number, total: number) =>
        `Il ne reste rien à demander pour le moment. ${done} ${
          done > 1 ? "éléments" : "élément"
        } sur ${total} ${done > 1 ? "sont confirmés" : "est confirmé"}. Vous pouvez restaurer les éléments écartés pour compléter votre socle.`,
      correctPrompt: "Reformulez, je remplacerai la version précédente.",
      claimCardTitle: "Ce que j'ai compris",
      kindLabels: {
        role: "Rôle",
        seniority: "Séniorité",
        years_experience: "Années d'expérience",
        summary: "Résumé",
        skill: "Compétence",
        achievement: "Réalisation",
      },
      foundation: (done: number, total: number) =>
        `Socle du profil : ${done} ${done > 1 ? "éléments" : "élément"} sur ${total}`,
      supported: "appuyé par une preuve",
      declaredBy: "déclarée par vous",
      answerErrors: {
        empty: "Écrivez votre réponse avant d'envoyer.",
        years_invalid: "Indiquez un nombre d'années entre 0 et 80.",
      },
      evidenceForm: {
        title: "Nouvelle preuve",
        fields: {
          title: "Titre",
          organization: "Projet ou mission",
          statement: "Résultat obtenu",
          metric: "Métrique (ex. +18 % de conversion)",
          period: "Période",
          rolePlayed: "Rôle joué",
          skills: "Compétences démontrées (séparées par des virgules)",
          sourceReference: "Provenance (lien ou référence)",
        },
        submit: "Ajouter la preuve",
        cancel: "Plus tard",
        attach: (title: string) => `Rattacher à « ${title} »`,
      },
      panel: {
        skills: "Compétences",
        achievements: "Réalisations",
        evidence: "Preuves",
        addEvidence: "Ajouter une preuve",
        attachedTo: (label: string) => `Rattachée à « ${label} »`,
        detach: "Détacher",
        empty: "Votre profil se construira ici au fil de l'entretien.",
      },
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
    interview: {
      welcome:
        "Hello. Let's build your professional profile — one question at a time.",
      resume: "Let's pick up where we left off.",
      understood: "Here's what I understood — tell me if that's right.",
      questions: {
        role: "Which professional role do you want to present first?",
        seniority: "How would you describe your seniority in that role?",
        years_experience: "How many years of experience do you carry?",
        summary: "In a few sentences, how would you sum up your track record?",
        skill: "Which key skill do you want to highlight?",
        achievement: "Which concrete achievement best shows your value?",
      },
      deepenQuestions: {
        role: "Let's refine: what exact title, for what kind of missions?",
        seniority:
          "Let's refine: what concretely characterizes that level (scope, leadership, autonomy)?",
        years_experience:
          "Let's refine that number: how many years on this core expertise precisely?",
        summary:
          "Let's rephrase: what truly sets you apart, in one or two strong sentences?",
        skill:
          "Let's refine: how would a client immediately recognize this skill?",
        achievement:
          "Let's refine: what was the context, and what measurable outcome?",
      },
      suggestEvidence: (title: string) =>
        `Would you like to back “${title}” with concrete proof?`,
      complete:
        "Your profile foundation is in place. Enrich it or correct anything that changed.",
      pausedIncomplete: (done: number, total: number) =>
        `Nothing left to ask for now. ${done} of ${total} ${
          done > 1 ? "elements are" : "element is"
        } confirmed. Restore the set-aside elements to complete your foundation.`,
      correctPrompt: "Rephrase it — I'll replace the previous version.",
      claimCardTitle: "What I understood",
      kindLabels: {
        role: "Role",
        seniority: "Seniority",
        years_experience: "Years of experience",
        summary: "Summary",
        skill: "Skill",
        achievement: "Achievement",
      },
      foundation: (done: number, total: number) =>
        `Profile foundation: ${done} of ${total} elements`,
      supported: "backed by proof",
      declaredBy: "declared by you",
      answerErrors: {
        empty: "Write your answer before sending.",
        years_invalid: "Give a number of years between 0 and 80.",
      },
      evidenceForm: {
        title: "New proof",
        fields: {
          title: "Title",
          organization: "Project or mission",
          statement: "Outcome",
          metric: "Metric (e.g. +18% conversion)",
          period: "Period",
          rolePlayed: "Role played",
          skills: "Skills demonstrated (comma-separated)",
          sourceReference: "Source (link or reference)",
        },
        submit: "Add proof",
        cancel: "Later",
        attach: (title: string) => `Attach to “${title}”`,
      },
      panel: {
        skills: "Skills",
        achievements: "Achievements",
        evidence: "Proof",
        addEvidence: "Add proof",
        attachedTo: (label: string) => `Attached to “${label}”`,
        detach: "Detach",
        empty: "Your profile will build here as the interview goes.",
      },
    },
  },
} as const;

export function t(locale: Locale = DEFAULT_LOCALE) {
  return copy[locale];
}
