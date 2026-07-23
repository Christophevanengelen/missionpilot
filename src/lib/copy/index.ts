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
        history: "Historique",
        preferences: "Préférences & contraintes",
        versions: {
          title: "Versions",
          current: (n: number) => `Version actuelle : ${n}`,
          none: "Aucune version confirmée pour le moment.",
          publish: "Figer une version du profil",
          needConfirmed:
            "Confirmez au moins un élément pour pouvoir figer une version.",
          published: (n: number, summary: string) =>
            `Version ${n} figée — « ${summary} »`,
          noop: (n: number) =>
            `Aucun changement de fond depuis la version ${n} — aucune nouvelle version n'a été créée.`,
          unknown:
            "La connexion a été interrompue pendant la publication de la version : son résultat est incertain. Réessayez — une version identique n'est jamais créée en double.",
        },
      },
    },
    history: {
      title: "Historique du profil",
      subtitle:
        "Les versions confirmées de votre profil, de la plus récente à la plus ancienne.",
      empty:
        "Aucune version confirmée pour le moment. Votre profil de travail n'est pas encore figé dans une version.",
      loadError:
        "L'historique n'a pas pu être chargé. Réessayez — vos versions sont intactes.",
      versionLabel: (n: number) => `Version ${n}`,
      latestBadge: "Version la plus récente",
      restoredFrom: (n: number) =>
        `Issue de la restauration de la version ${n}`,
      confirmedOn: (date: string) => `Confirmée le ${date}`,
      noSummary: "Aucun résumé enregistré pour cette version.",
      backToProfile: "Revenir au profil actuel",
      backToHistory: "Retour à l'historique",
      openVersion: "Consulter",
      readOnlyNotice:
        "Vous consultez une version confirmée, en lecture seule. Votre profil de travail actuel n'est pas modifié.",
      versionUnavailable:
        "Cette version n'existe pas ou n'est plus disponible.",
      emptyVersion: "Cette version ne contient aucun élément confirmé.",
      compare: {
        title: "Comparaison",
        direction: (a: number, b: number) => `Version ${a} → Version ${b}`,
        reference: "Version de référence",
        compared: "Version comparée",
        invert: "Inverser",
        sameVersion:
          "Comparer une version avec elle-même n'apporterait aucun changement. Choisissez deux versions différentes.",
        changesCount: (n: number) =>
          n === 0
            ? "Aucun changement"
            : `${n} ${n > 1 ? "changements" : "changement"}`,
        countsDetail: (added: number, modified: number, removed: number) =>
          [
            `${added} ${added > 1 ? "ajouts" : "ajout"}`,
            `${modified} ${modified > 1 ? "modifications" : "modification"}`,
            `${removed} ${removed > 1 ? "suppressions" : "suppression"}`,
          ].join(" · "),
        added: "Ajouté",
        modified: "Modifié",
        removed: "Supprimé",
        unchanged: "Inchangé",
        before: "Avant",
        after: "Après",
        evidenceAdded: "Preuve rattachée",
        evidenceRemoved: "Preuve détachée",
        evidenceChanged: "Preuve mise à jour",
      },
      restoreAction: "Restaurer cette version",
      restore: {
        warning:
          "Cette version remplacera le contenu actuel de votre profil. Une nouvelle version retraçant cette restauration sera créée. Toutes les versions existantes seront conservées.",
        cancel: "Annuler",
        confirm: "Restaurer cette version",
        success: (source: number, created: number) =>
          `Version ${source} restaurée. Votre profil de travail a été remplacé et la version ${created} retrace cette restauration. Toutes les versions existantes sont conservées.`,
        noop: "Aucune modification n'a été effectuée : le contenu de cette version est déjà identique à votre version la plus récente.",
        missingEvidence: (n: number) =>
          `${n} ${n > 1 ? "preuves d'origine ne sont plus disponibles et n'ont pas pu être rattachées" : "preuve d'origine n'est plus disponible et n'a pas pu être rattachée"}.`,
        error:
          "La restauration n'a pas abouti. Votre profil et vos versions n'ont pas été modifiés — réessayez.",
        unknown:
          "La connexion a été interrompue pendant la restauration : son résultat est incertain. Rouvrez l'historique pour vérifier l'état réel avant de réessayer.",
      },
    },
    opportunities: {
      title: "Opportunités",
      subtitle:
        "Importez une annonce : nous en gardons une copie source figée et en extrayons les données, à vérifier par vous.",
      importLabel: "Coller le texte d'une annonce",
      importPlaceholder:
        "Collez ici le texte complet d'une offre de mission ou de poste…",
      importButton: "Importer l'annonce",
      importEmpty: "Collez le texte d'une annonce avant d'importer.",
      urlLabel: "Lien de l'annonce (facultatif)",
      urlPlaceholder: "https://…",
      urlNote:
        "Nous ne récupérons pas automatiquement le contenu du lien : collez le texte ci-dessous. Le lien est enregistré comme provenance.",
      urlBlocked: {
        invalid_url: "Ce lien n'est pas une URL valide.",
        unsupported_scheme: "Seuls les liens http(s) sont acceptés.",
        private_host:
          "Ce lien pointe vers une adresse interne ou une IP — non accepté comme source.",
        terms_forbid:
          "Les conditions de ce site interdisent l'import de ses annonces. Vous pouvez toujours coller le texte sans indiquer de lien.",
      },
      importError:
        "L'import n'a pas abouti. Vérifiez le texte collé et réessayez.",
      importedNew: "Opportunité importée.",
      importedDuplicate:
        "Déjà importée — une nouvelle capture a été ajoutée à l'opportunité existante.",
      viewOpportunity: "Voir l'opportunité",
      importAnother: "Importer une autre annonce",
      seenCount: (n: number) => (n === 1 ? "Vue 1 fois" : `Vue ${n} fois`),
      listEmpty:
        "Aucune opportunité pour le moment. Importez une première annonce ci-dessus.",
      unknownsNote: (n: number) =>
        n === 0
          ? "Tous les champs ont pu être renseignés (à vérifier)."
          : `${n} ${n > 1 ? "champs n'ont" : "champ n'a"} pas pu être déterminé${n > 1 ? "s" : ""} depuis la source.`,
      openDetail: "Inspecter",
      unverifiedBanner:
        "Données extraites automatiquement de la source — non vérifiées. Elles servent à l'inspection, pas de vérité.",
      sections: {
        normalized: "Données normalisées",
        unknowns: "Champs non déterminés",
        source: "Capture source (figée)",
      },
      fields: {
        title: "Intitulé",
        organization: "Organisation",
        engagementType: "Type d'engagement",
        seniority: "Séniorité",
        remoteType: "Télétravail",
        locationText: "Localisation",
        compensation: "Rémunération",
        requirements: "Exigences",
        responsibilities: "Missions",
        skills: "Compétences",
        sourceUrl: "Lien source",
        description: "Description",
      },
      remoteTypes: {
        remote_only: "100 % à distance",
        hybrid: "Hybride",
        onsite: "Sur site",
        unspecified: "Non précisé",
      },
      engagementTypes: {
        freelance: "Freelance",
        part_time: "Temps partiel",
        interim: "Intérim",
        permanent: "Permanent",
      },
      capturedAt: (date: string) => `Capturée le ${date}`,
      backToList: "Retour aux opportunités",
      notFound: "Cette opportunité n'existe pas ou n'est plus disponible.",
      none: "Non déterminé",
    },
    preferences: {
      title: "Préférences & contraintes",
      subtitle:
        "Vos critères de mission. Facultatifs — ils orienteront plus tard les recommandations, jamais votre profil lui-même.",
      backToProfile: "Revenir au profil",
      sections: {
        targeting: "Ciblage",
        conditions: "Conditions",
        exclusions: "Exclusions",
      },
      fields: {
        targetRoleFamilies: "Familles de rôles visées",
        preferredEngagementTypes: "Types d'engagement préférés",
        languages: "Langues de travail",
        allowedWorkRegions: "Régions de travail autorisées",
        hardExclusions: "Exclusions absolues",
        targetDayRate: "TJM visé",
        minimumDayRate: "TJM plancher",
        baseCurrency: "Devise",
        remotePolicy: "Politique de télétravail",
        timezoneOverlap: "Chevauchement horaire attendu",
        travelTolerance: "Tolérance aux déplacements",
      },
      hints: {
        list: "Séparez par des virgules (20 max).",
        rateFloor: "Le TJM plancher ne peut pas dépasser le TJM visé.",
        timezoneOverlap:
          "Ex. « CET ±3 h » ou « 4 h de recouvrement avec Paris ».",
      },
      engagementTypes: {
        freelance: "Freelance",
        part_time: "Temps partiel",
        interim: "Intérim",
        permanent: "Permanent",
      },
      remotePolicies: {
        remote_only: "100 % à distance",
        remote_first: "À distance en priorité",
        hybrid: "Hybride",
        onsite_ok: "Sur site accepté",
      },
      travelTolerances: {
        none: "Aucun déplacement",
        occasional: "Occasionnels",
        frequent: "Fréquents",
      },
      none: "Non précisé",
      save: "Enregistrer les préférences",
      saved: "Préférences enregistrées.",
      error:
        "Les préférences n'ont pas pu être enregistrées — vérifiez les valeurs et réessayez.",
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
        history: "History",
        preferences: "Preferences & constraints",
        versions: {
          title: "Versions",
          current: (n: number) => `Current version: ${n}`,
          none: "No confirmed version yet.",
          publish: "Freeze a profile version",
          needConfirmed:
            "Confirm at least one element before freezing a version.",
          published: (n: number, summary: string) =>
            `Version ${n} frozen — “${summary}”`,
          noop: (n: number) =>
            `No substantive change since version ${n} — no new version was created.`,
          unknown:
            "The connection dropped while freezing the version: its outcome is uncertain. Try again — an identical version is never created twice.",
        },
      },
    },
    history: {
      title: "Profile history",
      subtitle: "The confirmed versions of your profile, newest first.",
      empty:
        "No confirmed version yet. Your working profile has not been frozen into a version.",
      loadError:
        "The history could not be loaded. Try again — your versions are intact.",
      versionLabel: (n: number) => `Version ${n}`,
      latestBadge: "Latest version",
      restoredFrom: (n: number) => `Created by restoring version ${n}`,
      confirmedOn: (date: string) => `Confirmed on ${date}`,
      noSummary: "No summary recorded for this version.",
      backToProfile: "Back to current profile",
      backToHistory: "Back to history",
      openVersion: "View",
      readOnlyNotice:
        "You are viewing a confirmed version, read-only. Your current working profile is not modified.",
      versionUnavailable: "This version does not exist or is unavailable.",
      emptyVersion: "This version contains no confirmed element.",
      compare: {
        title: "Comparison",
        direction: (a: number, b: number) => `Version ${a} → Version ${b}`,
        reference: "Reference version",
        compared: "Compared version",
        invert: "Invert",
        sameVersion:
          "Comparing a version with itself would show no change. Pick two different versions.",
        changesCount: (n: number) =>
          n === 0 ? "No change" : `${n} ${n > 1 ? "changes" : "change"}`,
        countsDetail: (added: number, modified: number, removed: number) =>
          [
            `${added} ${added > 1 ? "additions" : "addition"}`,
            `${modified} ${modified > 1 ? "modifications" : "modification"}`,
            `${removed} ${removed > 1 ? "removals" : "removal"}`,
          ].join(" · "),
        added: "Added",
        modified: "Modified",
        removed: "Removed",
        unchanged: "Unchanged",
        before: "Before",
        after: "After",
        evidenceAdded: "Proof attached",
        evidenceRemoved: "Proof detached",
        evidenceChanged: "Proof updated",
      },
      restoreAction: "Restore this version",
      restore: {
        warning:
          "This version will replace the current content of your profile. A new version tracing this restore will be created. Every existing version is kept.",
        cancel: "Cancel",
        confirm: "Restore this version",
        success: (source: number, created: number) =>
          `Version ${source} restored. Your working profile was replaced and version ${created} traces this restore. Every existing version is kept.`,
        noop: "Nothing was changed: this version's content is already identical to your latest version.",
        missingEvidence: (n: number) =>
          `${n} original ${n > 1 ? "proofs are" : "proof is"} no longer available and could not be re-attached.`,
        error:
          "The restore did not go through. Your profile and versions were not modified — try again.",
        unknown:
          "The connection dropped during the restore: its outcome is uncertain. Reopen the history to check the real state before trying again.",
      },
    },
    opportunities: {
      title: "Opportunities",
      subtitle:
        "Import a listing: we keep a frozen source copy and extract its data, for you to verify.",
      importLabel: "Paste a listing's text",
      importPlaceholder:
        "Paste the full text of a mission or job listing here…",
      importButton: "Import listing",
      importEmpty: "Paste a listing's text before importing.",
      urlLabel: "Listing link (optional)",
      urlPlaceholder: "https://…",
      urlNote:
        "We do not fetch the link's content automatically: paste the text below. The link is recorded as provenance.",
      urlBlocked: {
        invalid_url: "That link is not a valid URL.",
        unsupported_scheme: "Only http(s) links are accepted.",
        private_host:
          "That link points to an internal address or IP — not accepted as a source.",
        terms_forbid:
          "This site's terms forbid importing its listings. You can still paste the text without a link.",
      },
      importError:
        "The import did not go through. Check the text and try again.",
      importedNew: "Opportunity imported.",
      importedDuplicate:
        "Already imported — a new snapshot was appended to the existing opportunity.",
      viewOpportunity: "View opportunity",
      importAnother: "Import another listing",
      seenCount: (n: number) => (n === 1 ? "Seen once" : `Seen ${n} times`),
      listEmpty: "No opportunities yet. Import a first listing above.",
      unknownsNote: (n: number) =>
        n === 0
          ? "Every field could be filled (to verify)."
          : `${n} field${n > 1 ? "s" : ""} could not be determined from the source.`,
      openDetail: "Inspect",
      unverifiedBanner:
        "Data extracted automatically from the source — unverified. For inspection, not ground truth.",
      sections: {
        normalized: "Normalized data",
        unknowns: "Undetermined fields",
        source: "Source capture (frozen)",
      },
      fields: {
        title: "Title",
        organization: "Organization",
        engagementType: "Engagement type",
        seniority: "Seniority",
        remoteType: "Remote",
        locationText: "Location",
        compensation: "Compensation",
        requirements: "Requirements",
        responsibilities: "Responsibilities",
        skills: "Skills",
        sourceUrl: "Source link",
        description: "Description",
      },
      remoteTypes: {
        remote_only: "Remote only",
        hybrid: "Hybrid",
        onsite: "Onsite",
        unspecified: "Unspecified",
      },
      engagementTypes: {
        freelance: "Freelance",
        part_time: "Part-time",
        interim: "Interim",
        permanent: "Permanent",
      },
      capturedAt: (date: string) => `Captured on ${date}`,
      backToList: "Back to opportunities",
      notFound: "This opportunity does not exist or is unavailable.",
      none: "Undetermined",
    },
    preferences: {
      title: "Preferences & constraints",
      subtitle:
        "Your mission criteria. Optional — they will later steer recommendations, never your profile itself.",
      backToProfile: "Back to profile",
      sections: {
        targeting: "Targeting",
        conditions: "Conditions",
        exclusions: "Exclusions",
      },
      fields: {
        targetRoleFamilies: "Target role families",
        preferredEngagementTypes: "Preferred engagement types",
        languages: "Working languages",
        allowedWorkRegions: "Allowed work regions",
        hardExclusions: "Hard exclusions",
        targetDayRate: "Target day rate",
        minimumDayRate: "Minimum day rate",
        baseCurrency: "Currency",
        remotePolicy: "Remote policy",
        timezoneOverlap: "Expected timezone overlap",
        travelTolerance: "Travel tolerance",
      },
      hints: {
        list: "Comma-separated (20 max).",
        rateFloor: "The minimum day rate cannot exceed the target day rate.",
        timezoneOverlap: "e.g. “CET ±3h” or “4h overlap with Paris”.",
      },
      engagementTypes: {
        freelance: "Freelance",
        part_time: "Part-time",
        interim: "Interim",
        permanent: "Permanent",
      },
      remotePolicies: {
        remote_only: "Remote only",
        remote_first: "Remote first",
        hybrid: "Hybrid",
        onsite_ok: "Onsite OK",
      },
      travelTolerances: {
        none: "No travel",
        occasional: "Occasional",
        frequent: "Frequent",
      },
      none: "Not set",
      save: "Save preferences",
      saved: "Preferences saved.",
      error: "Preferences could not be saved — check the values and try again.",
    },
  },
} as const;

export function t(locale: Locale = DEFAULT_LOCALE) {
  return copy[locale];
}
