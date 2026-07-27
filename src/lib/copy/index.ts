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
    dashboard: {
      hero: {
        title: "Bienvenue sur MissionPilot",
        lead: "Uploadez votre CV : nous comprenons votre parcours, en déduisons votre rôle prioritaire et vos compétences cœur, puis cherchons automatiquement les offres qui vous correspondent — avec un score et le pourquoi de chaque match. Il n'y a plus qu'à découvrir le résultat.",
        privacy:
          "Votre CV n'est jamais conservé : l'analyse se fait en mémoire, seul le profil validé est enregistré.",
      },
      status: {
        title: "Votre tableau de bord",
        roleLabel: "Rôle prioritaire",
        roleMissing: "À confirmer dans votre profil",
        skillsLabel: (n: number) =>
          `${n} ${n > 1 ? "compétences confirmées" : "compétence confirmée"}`,
        targetsLabel: "Métiers recherchés",
        targetsMissing: "Aucun métier cible pour l'instant",
        offersLabel: (n: number) =>
          n === 0
            ? "Aucune offre découverte pour l'instant"
            : `${n} ${n > 1 ? "offres découvertes" : "offre découverte"}`,
        analyzedLabel: (n: number) =>
          `${n} ${n > 1 ? "analysées par l'IA" : "analysée par l'IA"}`,
        seeOffers: "Voir mes offres",
        refreshCta: "Importer un nouveau CV / compléter mon profil",
        noOffersHint:
          "Complétez votre profil ou importez votre CV pour lancer la découverte d'offres.",
      },
      positioning: {
        title: "Votre positionnement",
        coverage: (pct: number) => `${pct} % du top 8 couvert`,
        note: (n: number) =>
          `D'après les ${n} offres découvertes qui listent leurs compétences — les 8 compétences les plus demandées de ce marché, et celles que votre profil couvre. Ce n'est pas un classement face à d'autres candidats.`,
        // label · part des offres du sous-corpus qui demandent cette compétence
        chip: (label: string, share: number) =>
          `${label} · ${share} % des offres`,
        legend: "✓ couvert par votre profil · + absent de votre profil",
        covered: "(couvert par votre profil)",
        missing: "(absent de votre profil)",
      },
    },
    home: {
      heroTitle: "Déposez votre CV. On s'occupe du reste.",
      heroLead:
        "On lit votre parcours, on comprend où vous en êtes — et à chaque connexion, on vous montre ce que le marché a pour vous maintenant. Y compris le poste d'un cran au-dessus.",
      heroPromise:
        "Rien qui soit déjà pourvu. On ne postule jamais à votre place : vous cliquez, vous partez sur l'annonce d'origine.",
      mirrorTitle: "Voilà ce que j'ai compris.",
      mirrorLead:
        "Corrigez-moi si je me trompe. Il me manque encore une chose avant de pouvoir chercher sérieusement pour vous.",
      mirrorHeading: "Votre parcours, tel que je l'ai lu",
      mirrorUnknown: "votre CV ne le dit pas",
      mirrorSkills: (n: number) =>
        n === 1 ? "1 compétence retenue" : `${n} compétences retenues`,
      mirrorAsk: (ask: string) =>
        `Donnez-moi ${ask}, et je lance la recherche à chaque connexion.`,
      mirrorAskLink: "Compléter mon profil",
      answerSubmit: "Valider",
      answerDontKnow: "Je ne sais pas",
      answerUnreadable:
        "Je n'ai pas su lire cette réponse. Reformulez-la, ou choisissez une des options.",
      answerFailed: "Je n'ai pas pu enregistrer. Réessayez.",
      resultsTitle: "Ce que le marché a pour vous",
      resultsLead:
        "Les plateformes que nous couvrons, interrogées en direct. Chaque résultat mène à l'annonce d'origine.",
      searching: "Nous interrogeons les plateformes…",
      nudge: (score: number, ask: string) =>
        `Profil à ${score} %. En nous donnant ${ask}, on cherche mieux pour vous.`,
      nudgeLink: "Compléter",
      unconfigured:
        "Aucune source n'est encore activée. Il n'y a rien à chercher pour l'instant.",
    },
    search: {
      title: "Recherche d'opportunités",
      subtitle:
        "Ce qui est ouvert en ce moment sur les plateformes configurées. Rien n'est stocké : chaque résultat est un lien vers l'annonce d'origine.",
      queryLabel: "Métier recherché",
      queryPlaceholder: "Service Designer",
      queryHint:
        "Laissez vide pour chercher sur les métiers déduits de votre CV.",
      submit: "Chercher",
      refine: "Relancer avec ces critères",
      refineSummary: "Chercher autre chose",
      // The staircase. The step up leads, because it is the reason the product
      // exists: people apply for the job they already had.
      bandStepUp: (level: string | null) =>
        level ? `La marche d'après — ${level}` : "La marche d'après",
      bandStepUpNote:
        "Ces postes sont un cran au-dessus de votre niveau actuel. Votre parcours montre que vous pouvez les défendre.",
      bandLevel: (level: string | null) =>
        level ? `À votre niveau — ${level}` : "À votre niveau",
      searchedAs: (titles: readonly string[]) =>
        `Cherché sous : ${titles.join(", ")}`,
      searchedAsNote:
        "Les plateformes ne formulent pas les métiers comme votre CV. Voici les intitulés sous lesquels nous avons cherché pour vous.",
      trajectoryTitle: (current: string, next: string) =>
        `Vous êtes ${current}. La marche d'après, c'est ${next}.`,
      trajectoryEvidence: "Ce qui, dans votre parcours, le justifie",
      trajectoryMissing:
        "Ce qu'un recruteur cherchera et ne trouvera pas encore",
      trajectoryQuestions: "Ce qu'il nous manque pour en être sûrs",
      autoNote:
        "Cette liste a été cherchée pour vous à l'ouverture, sur les métiers déduits de votre CV. Ajustez ci-dessous si vous voulez autre chose.",
      // Deux messages et non un seul : « on n'a pas su formuler votre
      // recherche » et « la recherche a échoué » ne se réparent pas du tout de
      // la même façon. Les confondre enverrait la moitié des gens cliquer sur
      // un bouton qui ne peut rien pour eux.
      openingNoPlan:
        "Nous n'avons pas su formuler une recherche pour vous : votre métier visé n'est pas encore renseigné.",
      openingNoPlanAction: "Choisir un métier et chercher",
      openingFailed:
        "La recherche d'ouverture n'a pas abouti. Rien n'a pu être interrogé.",
      openingFailedAction: "Relancer la recherche",
      loading: "Nous interrogeons les plateformes…",
      searching: "Recherche en cours…",
      refineLabel: "Affiner les résultats",
      engagementLabel: "Type d'engagement",
      remoteLabel: "Télétravail",
      notStated: "Non précisé",
      ageLabel: "Publiées depuis",
      ageWindow: (days: number) => `${days} jours`,
      ageAll: "Sans limite",
      // Relative age, because "il y a 3 jours" is read instantly where an
      // absolute date forces a mental subtraction.
      age: (days: number) =>
        days <= 0
          ? "publiée aujourd'hui"
          : days === 1
            ? "publiée hier"
            : `publiée il y a ${days} jours`,
      ageUnknown: "date de publication non communiquée",
      alsoOn: (names: readonly string[]) => `aussi sur ${names.join(", ")}`,
      countriesLabel: "Pays cherchés",
      countriesHint: (max: number) =>
        `Jusqu'à ${max} pays par recherche. Chaque pays est une interrogation supplémentaire des sources qui séparent leur index par pays.`,
      countryLabel: "Pays ou région",
      placeFilterLabel: "Filtrer par lieu",
      countryPlaceholder: "France, Belgique…",
      includeUnstated: "Garder les offres qui ne précisent pas ces critères",
      includeUnstatedNote:
        "La plupart des annonces restent muettes sur le contrat, le télétravail ou le lieu. Les écarter reviendrait à cacher de bonnes offres pour une source avare — on préfère vous dire qu'on ne sait pas.",
      unstatedNote: (n: number) =>
        `${n} ${n > 1 ? "offres affichées ne précisent pas" : "offre affichée ne précise pas"} un critère que vous avez filtré.`,
      sortLabel: "Trier par",
      sortKeys: {
        relevance: "Pertinence",
        compensation: "Rémunération",
        organization: "Entreprise",
        title: "Intitulé",
        source: "Source",
      } as Record<string, string>,
      sortDesc: "Décroissant",
      sortAsc: "Croissant",
      resultCount: (shown: number, total: number) =>
        shown === total
          ? `${total} ${total > 1 ? "offres trouvées" : "offre trouvée"}.`
          : `${shown} ${shown > 1 ? "offres affichées" : "offre affichée"} sur ${total} trouvées.`,
      noneShown:
        "Aucune offre ne passe vos filtres. Élargissez-les, ou gardez les offres non précisées.",
      untitled: "Offre sans intitulé",
      noMeta: "Aucun détail précisé par la source.",
      scoreLabel: (n: number) => `${n} % de correspondance`,
      // Verifiable beats impressive: a benchmark found an unexplained
      // "87 % compatible" reads as arbitrary, while "3 of your skills, of the
      // 8 asked for" can be checked against the posting in ten seconds.
      skillMatch: (matched: number, demanded: number) =>
        `${matched} de vos compétences sur les ${demanded} demandées`,
      skillMatchNone: (demanded: number) =>
        `Aucune de vos compétences confirmées parmi les ${demanded} demandées`,
      skillsUnknown: "Cette annonce ne liste pas de compétences.",
      compPeriods: {
        year: "an",
        month: "mois",
        day: "jour",
        hour: "heure",
      } as Record<string, string>,
      payConverted: (amount: string, annual: string) =>
        `${amount} · ≈ ${annual}/an (base 218 jours facturables)`,
      openOnSource: "Voir l'annonce d'origine",
      unknownFields: (n: number) =>
        `${n} ${n > 1 ? "champs non précisés" : "champ non précisé"} par la source.`,
      partial: (
        sources: readonly { name: string; failed: number; total: number }[],
      ) => {
        const parts = sources.map((s) =>
          s.failed >= s.total
            ? `${s.name} n'a rien renvoyé`
            : `${s.name} : ${s.failed} recherche(s) en échec sur ${s.total}`,
        );
        return `Résultats incomplets — ${parts.join(" ; ")}.`;
      },
      unconfigured:
        "Aucune source légale n'est configurée. Activez-en une pour lancer une recherche.",
      errors: {
        unconfigured: "Aucune source légale n'est configurée.",
        no_keywords:
          "Saisissez un métier, ou importez votre CV pour que nous en déduisions un.",
        generic: "La recherche n'a pas abouti. Réessayez.",
      } as Record<string, string>,
    },
    applications: {
      title: "Suivi des candidatures",
      subtitle:
        "Votre pipeline de missions — de l'offre repérée à l'offre reçue.",
      empty:
        "Aucune candidature suivie. Ouvrez une offre et ajoutez-la à votre suivi.",
      followUpsTitle: "Relances à faire",
      followUpDue: (date: string) => `relance prévue le ${date}`,
      untitled: "Offre sans titre",
      open: "Ouvrir",
    },
    cvImport: {
      title: "Importer mon CV",
      note: "Déposez votre CV (PDF) ou collez son texte : nous détectons vos compétences et vous choisissez celles à ajouter. Le fichier n'est jamais conservé.",
      fileLabel: "CV (PDF)",
      pasteLabel: "…ou collez le texte de votre CV",
      pastePlaceholder: "Collez ici le contenu de votre CV…",
      analyze: "Analyser mon CV",
      needInput: "Déposez un PDF ou collez le texte de votre CV.",
      noneDetected:
        "Aucune compétence connue détectée dans ce document. Vous pouvez les ajouter via l'entretien ci-dessous.",
      detectedTitle: "Compétences détectées dans votre CV",
      detectedNote:
        "Désélectionnez ce qui ne vous correspond pas, puis ajoutez : votre sélection vaut validation, les compétences rejoignent votre profil confirmées et la recherche d'offres se lance automatiquement.",
      aiNote:
        "L'IA a aussi lu votre CV pour repérer des compétences hors liste — vérifiez-les avant d'ajouter.",
      chooseOne: "Sélectionnez au moins une compétence.",
      addChosen: "Ajouter à mon profil",
      back: "Recommencer",
      added: (n: number) =>
        n === 0
          ? "Ces compétences étaient déjà dans votre profil."
          : `${n} ${n > 1 ? "compétences confirmées" : "compétence confirmée"} dans votre profil.`,
      again: "Importer un autre document",
      applied: (n: number) =>
        `Profil mis à jour — ${n} ${n > 1 ? "éléments confirmés" : "élément confirmé"}.`,
      appliedNote:
        "Votre rôle, résumé, compétences cœur et métiers cibles sont en place. Tout reste ajustable dans votre profil.",
      seeOffers: "Découvrir mes offres",
      understood: {
        title: "Voici ce que j'ai compris de votre parcours",
        note: "Vérifiez, décochez ce qui ne colle pas, puis validez en un clic — tout reste modifiable ensuite.",
        roleLabel: "Rôle prioritaire",
        years: (n: number) => `${n} ans d'expérience`,
        summaryLabel: "Résumé professionnel",
        skillsLabel: "Compétences cœur (récurrentes dans vos expériences)",
        targetsLabel: "Métiers cibles pour la recherche d'offres",
        apply: "C'est bien moi — tout ajouter",
        unsureNote:
          "L'assistant n'était pas certain de sa lecture — vérifiez attentivement avant de valider.",
      },
      linkedin: {
        title: "…ou importez votre export LinkedIn",
        note: "Déposez ici l'archive que LinkedIn vous a envoyée par e-mail.",
        fileLabel: "Archive d'export LinkedIn (.zip)",
        analyze: "Analyser mon export LinkedIn",
        needFile: "Déposez votre archive d'export LinkedIn (.zip).",
        detectedTitle: "Compétences détectées dans votre export LinkedIn",
      },
      /**
       * L'import automatique par l'API LinkedIn. Les mots comptent ici :
       * « connecter » promettrait un bouton OAuth qui n'existe pas pour ce
       * produit, et « jeton » dit la vérité sur ce qui est demandé. La phrase
       * sur la non-conservation n'est pas rassurante par politesse : c'est la
       * règle appliquée dans le code, où le jeton n'est ni stocké ni journalisé.
       */
      linkedinApi: {
        title: "…ou remplissez avec LinkedIn",
        note: "LinkedIn vous demandera votre accord, puis nous enverra vos postes, formations et compétences. Rien n'est confirmé automatiquement : vous relisez et vous validez, comme pour un CV. Réservé aux membres de l'UE et de Suisse.",
        tokenLabel: "Jeton d'accès LinkedIn",
        tokenHelp:
          "L'autorisation n'est pas conservée : elle sert à cet import, puis elle disparaît.",
        portail: "Ouvrir le portail développeur LinkedIn",
        analyze: "Remplir avec LinkedIn",
        needToken: "Collez le jeton généré dans le portail LinkedIn.",
        rapportTitle: "Ce que LinkedIn a renvoyé",
        rapportVide: "aucune donnée",
        rapportLignes: (n: number) =>
          n === 1 ? "1 enregistrement" : `${n} enregistrements`,
      },
      errors: {
        empty: "Le document semble vide.",
        pdf: "Ce PDF n'a pas pu être lu. Collez plutôt le texte de votre CV.",
        linkedin:
          "Cette archive ne semble pas être un export LinkedIn. Vérifiez que c'est bien l'archive « Obtenir une copie de vos données ».",
        tooLarge:
          "Ce fichier dépasse 10 Mo. Exportez une version plus légère ou collez le texte de votre CV.",
        generic: "L'analyse n'a pas abouti. Réessayez.",
      },
      ats: {
        title: "Lisibilité par les logiciels de recrutement (ATS)",
        findings: {
          no_extractable_text:
            "Le texte de ce PDF ne s'extrait presque pas — c'est probablement une image scannée, que la plupart des ATS ne peuvent pas lire. Exportez un vrai PDF texte (pas une image).",
          no_sections:
            "Aucune section standard détectée (Expérience, Compétences, Formation) : un ATS pourrait ne pas savoir découper votre CV. Ajoutez des intitulés de section clairs.",
          no_contact:
            "Aucune adresse e-mail détectée — un ATS pourrait ne pas retrouver vos coordonnées.",
          too_long:
            "Ce CV dépasse 3 pages — souvent trop long pour être lu en entier.",
        } as Record<string, string>,
      },
    },
    recommendations: {
      title: "Recommandations reçues",
      subtitle:
        "Collez une recommandation reçue (LinkedIn, email…) et son lien de vérification : elle devient une preuve « testimonial » rattachée à votre profil.",
      listLabel: "Recommandations enregistrées",
      empty: "Aucune recommandation pour le moment. Ajoutez-en une ci-dessus.",
      verify: "Vérifier la source",
      noSource: "Sans lien de vérification",
      backToProfile: "Retour au profil",
      error: "L'ajout n'a pas abouti. Réessayez.",
      form: {
        recommender: "Qui vous recommande",
        relationship: "Relation",
        relationshipPlaceholder: "ex. ancien manager, client…",
        organization: "Organisation",
        sourceUrl: "Lien de vérification (recommandé)",
        sourceNote:
          "Le lien (ex. la recommandation sur LinkedIn) permet de retrouver et vérifier la source. Nous ne récupérons rien automatiquement — vous collez le texte vous-même.",
        text: "Texte de la recommandation",
        submit: "Ajouter la recommandation",
        required: "Indiquez au moins qui vous recommande et le texte.",
      },
    },
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
      gate: { eligible: "Éligible", review: "À vérifier", excluded: "Exclu" },
      gateHint: {
        eligible:
          "Aucune contrainte dure enfreinte d'après les données connues.",
        review:
          "Des données manquent pour trancher certaines contraintes dures.",
        excluded: "Enfreint au moins une de vos contraintes dures.",
      },
      hardConstraints: {
        section: "Contraintes dures",
        note: "Pré-filtre déterministe à partir de vos contraintes dures et des données extraites (non vérifiées) — ce n'est pas une recommandation.",
        checks: {
          remote: "Télétravail",
          engagement_type: "Type d'engagement",
          minimum_day_rate: "TJM minimum",
          hard_exclusions: "Exclusions",
          allowed_regions: "Zones de travail autorisées",
        },
        verdicts: {
          pass: "OK",
          violated: "Enfreint",
          unknown: "Indéterminé",
          not_constrained: "Non contraint",
        },
        excludedTerm: (term: string) => `Terme exclu détecté : « ${term} »`,
      },
      dayRate: {
        section: "TJM freelance indicatif",
        range: (low: number, high: number, currency: string) =>
          `~${low.toLocaleString("fr-FR")} à ~${high.toLocaleString("fr-FR")} ${currency}/jour`,
        note: "Estimation à partir du salaire annoncé : ÷ 218 jours facturables, × 1,5 à 2 pour un profil freelance (charges sociales, congés, intercontrats, risque). À affiner selon votre situation — c'est un repère, pas une garantie.",
      },
      matchScore: {
        section: "Score de correspondance",
        note: "Score déterministe à partir de vos préférences et de vos compétences confirmées — indicatif, pas une recommandation.",
        overall: (n: number) => `${n} / 100`,
        none: "Données insuffisantes pour un score.",
        confidenceLabel: "Confiance :",
        confidence: {
          none: "—",
          low: "faible",
          medium: "moyenne",
          high: "élevée",
        },
        components: {
          skills: "Compétences",
          rate: "TJM",
          remote: "Télétravail",
          engagement: "Type d'engagement",
        },
        unscored: "—",
        matchedSkills: "Compétences couvertes",
      },
      discover: {
        button: "Découvrir des offres",
        searching: "Recherche en cours…",
        result: (
          imported: number,
          duplicates: number,
          failed: number,
          // A source may have answered nothing at all: blaming the PROFILE for
          // an empty result would then state as fact something we did not
          // observe.
          incomplete = false,
        ) => {
          const found = imported + duplicates + failed;
          if (found === 0)
            return incomplete
              ? "Aucune offre récupérée cette fois-ci."
              : "Aucune offre trouvée pour votre profil cette fois-ci.";
          const parts = [
            `${imported} ${imported > 1 ? "nouvelles" : "nouvelle"}`,
            `${duplicates} déjà ${duplicates > 1 ? "connues" : "connue"}`,
          ];
          // "annonce non importée" ≠ "recherche en échec" below: one ad we
          // could not store, versus a search that never ran.
          if (failed > 0)
            parts.push(
              `${failed} ${failed > 1 ? "annonces non importées" : "annonce non importée"}`,
            );
          return `${found} ${found > 1 ? "offres trouvées" : "offre trouvée"} : ${parts.join(", ")}.`;
        },
        partial: (
          sources: readonly { name: string; failed: number; total: number }[],
        ) => {
          const parts = sources.map((s) =>
            s.failed >= s.total
              ? `${s.name} n'a rien renvoyé (${s.total} ${s.total > 1 ? "recherches" : "recherche"} en échec)`
              : `${s.name} : ${s.failed} ${s.failed > 1 ? "recherches" : "recherche"} en échec sur ${s.total}`,
          );
          // No "réessayez plus tard": a wrong credential or an API the account
          // is not subscribed to fails identically FOREVER, and we have just
          // measured that we cannot tell which. Promising that a retry helps
          // would assert a transience we did not observe.
          return `(Résultats incomplets — ${parts.join(" ; ")}. Si cela persiste, vérifiez la configuration de cette source.)`;
        },
        errors: {
          unconfigured:
            "La découverte automatique n'est pas encore activée (aucune source légale configurée).",
          no_keywords:
            "Confirmez d'abord un rôle ou des compétences dans votre profil (ou importez votre CV) pour guider la recherche.",
          generic: "La recherche n'a pas abouti. Réessayez.",
        },
        unconfiguredNote:
          "Découverte automatique : ajoutez des identifiants de source légale (Adzuna, France Travail, Remotive, Himalayas ou Jobicy) dans la configuration pour que MissionPilot cherche des offres correspondant à votre profil.",
      },
      insight: {
        button: "Expliquer mes matchs (IA)",
        analyzing: "Analyse des meilleures offres…",
        whyTitle: "Pourquoi ce match",
        fit: {
          strong: "Très bon match",
          good: "Bon match",
          weak: "Match faible",
        } as Record<string, string>,
        strengths: "Forces",
        gaps: "Points d'attention",
        needsReview:
          "Analyse incertaine — l'IA manque d'éléments, à lire avec recul.",
        result: (analyzed: number, failed: number) => {
          if (analyzed === 0 && failed === 0)
            return "Toutes vos meilleures offres sont déjà analysées.";
          const parts = [
            `${analyzed} ${analyzed > 1 ? "offres analysées" : "offre analysée"}`,
          ];
          if (failed > 0)
            parts.push(`${failed} en échec (réessayez plus tard)`);
          return `${parts.join(", ")}.`;
        },
        errors: {
          unconfigured:
            "L'explication des matchs n'est pas encore activée (clé OpenAI manquante).",
          no_profile:
            "Confirmez d'abord votre profil (rôle, compétences) — importez votre CV pour aller vite.",
          no_candidates:
            "Aucune offre analysable — vos offres sont exclues par vos critères ou sans texte.",
          busy: "Une analyse est déjà en cours — patientez un instant.",
          generic: "L'analyse n'a pas abouti. Réessayez.",
        },
      },
      breakdown: {
        title: "Détail de correspondance (IA)",
        note: "Chaque exigence de l'offre confrontée à votre profil validé, avec un conseil honnête pour améliorer votre CV là où c'est pertinent. C'est une proposition — jamais une invitation à inventer.",
        empty:
          "Lancez l'analyse détaillée pour voir, exigence par exigence, ce que votre profil couvre et comment renforcer votre CV.",
        button: "Analyser en détail",
        analyzing: "Analyse en cours…",
        refreshCta: "Réanalyser",
        importance: {
          must: "Indispensable",
          nice: "Souhaité",
        } as Record<string, string>,
        status: {
          covered: "Couvert",
          partial: "Partiel",
          missing: "Manquant",
        } as Record<string, string>,
        suggestionLabel: "Conseil",
        needsReview:
          "Analyse incertaine — l'IA manque d'éléments, à lire avec recul.",
        errors: {
          unconfigured:
            "L'analyse détaillée n'est pas encore activée (clé OpenAI manquante).",
          no_profile:
            "Confirmez d'abord votre profil (rôle, compétences) — importez votre CV pour aller vite.",
          not_found: "Cette offre n'a pas assez de contenu à analyser.",
          generic: "L'analyse n'a pas abouti. Réessayez.",
        },
      },
      application: {
        section: "Préparer ma candidature",
        note: "Un brouillon ancré sur votre profil validé : relisez-le, complétez les [crochets] avec vos vrais chiffres, puis envoyez-le vous-même depuis le site de l'offre. MissionPilot n'envoie jamais rien à votre place.",
        empty:
          "Générez une lettre de motivation taillée pour cette offre, plus vos points forts à mettre en avant.",
        button: "Préparer ma candidature",
        generating: "Préparation…",
        refreshCta: "Régénérer",
        coverLabel: "Lettre de motivation (brouillon modifiable)",
        highlightsLabel: "Points à mettre en avant",
        copy: "Copier la lettre",
        copied: "Copié !",
        needsReview:
          "Brouillon incertain — l'IA manque d'éléments, relisez attentivement.",
        errors: {
          unconfigured:
            "La préparation de candidature n'est pas encore activée (clé OpenAI manquante).",
          no_profile:
            "Confirmez d'abord votre profil (rôle, compétences) — importez votre CV pour aller vite.",
          not_found:
            "Cette offre n'a pas assez de contenu pour préparer une candidature.",
          generic: "La préparation n'a pas abouti. Réessayez.",
        },
      },
      interview: {
        section: "Préparer l'entretien",
        note: "Les questions probables pour cette offre, avec l'expérience de votre profil à mobiliser pour y répondre. Matériel de préparation — pas un script, et aucune garantie de résultat.",
        empty:
          "Générez votre brief d'entretien : questions probables et points à amener.",
        button: "Préparer l'entretien",
        preparing: "Préparation…",
        refreshCta: "Régénérer",
        questionsLabel: "Questions probables",
        talkingPointsLabel: "Points à amener",
        needsReview:
          "Brief incertain — l'IA manque d'éléments, à lire avec recul.",
        errors: {
          unconfigured:
            "La préparation d'entretien n'est pas encore activée (clé OpenAI manquante).",
          no_profile:
            "Confirmez d'abord votre profil (rôle, compétences) — importez votre CV pour aller vite.",
          not_found:
            "Cette offre n'a pas assez de contenu pour préparer un entretien.",
          generic: "La préparation n'a pas abouti. Réessayez.",
        },
      },
      tracking: {
        section: "Suivi de candidature",
        note: "Suivez cette offre dans votre pipeline. Ces informations restent privées.",
        stageLabel: "Étape",
        stages: {
          saved: "Enregistrée",
          prepared: "Préparée",
          applied: "Postulée",
          interview: "Entretien",
          offer: "Offre",
          rejected: "Refusée",
        } as Record<string, string>,
        noteLabel: "Note",
        notePlaceholder: "Contact, prochaines étapes, ressenti…",
        followUpLabel: "Relance le",
        save: "Enregistrer le suivi",
        saved: "Enregistré",
        untrack: "Retirer du suivi",
        error: "L'enregistrement n'a pas abouti. Réessayez.",
      },
      inbox: {
        all: "Tout",
        empty: "Aucune opportunité dans ce filtre.",
        filterLabel: "Filtrer les opportunités",
        gateLabel: "Filtrer par éligibilité",
        typeLabel: "Filtrer par type d'engagement",
        allTypes: "Tous les types",
        remoteLabel: "Filtrer par télétravail",
        allRemotes: "Tout télétravail",
      },
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
        sourceName: "Source",
        sourceUrl: "Lien source",
        description: "Description",
        // Attribution link label on the inbox card.
        viewOnSource: "Voir l'annonce d'origine",
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
    dashboard: {
      hero: {
        title: "Welcome to MissionPilot",
        lead: "Upload your CV: we understand your background, infer your priority role and core skills, then automatically find the offers that match you — with a score and the reason behind each match. All that's left is to discover the result.",
        privacy:
          "Your CV is never stored: the analysis runs in memory, only the validated profile is saved.",
      },
      status: {
        title: "Your dashboard",
        roleLabel: "Priority role",
        roleMissing: "To confirm in your profile",
        skillsLabel: (n: number) => `${n} skill${n === 1 ? "" : "s"} confirmed`,
        targetsLabel: "Target jobs",
        targetsMissing: "No target job yet",
        offersLabel: (n: number) =>
          n === 0
            ? "No offer discovered yet"
            : `${n} offer${n > 1 ? "s" : ""} discovered`,
        analyzedLabel: (n: number) => `${n} analyzed by AI`,
        seeOffers: "See my offers",
        refreshCta: "Import a new CV / complete my profile",
        noOffersHint:
          "Complete your profile or import your CV to start discovering offers.",
      },
      positioning: {
        title: "Your positioning",
        coverage: (pct: number) => `${pct}% of the top 8 covered`,
        note: (n: number) =>
          `Based on the ${n} discovered offers that list their skills — the 8 most demanded skills of this market, and the ones your profile covers. This is not a ranking against other candidates.`,
        chip: (label: string, share: number) =>
          `${label} · ${share}% of offers`,
        legend: "✓ covered by your profile · + missing from your profile",
        covered: "(covered by your profile)",
        missing: "(missing from your profile)",
      },
    },
    home: {
      heroTitle: "Drop your CV. We take it from there.",
      heroLead:
        "We read your track record, we work out where you stand — and on every visit we show you what the market has for you now. Including the role one rung up.",
      heroPromise:
        "No offer is stored. We never apply on your behalf: you click, you land on the original posting.",
      mirrorTitle: "Here is what I understood.",
      mirrorLead:
        "Correct me if I have it wrong. There is one more thing I need before I can search properly for you.",
      mirrorHeading: "Your track record, as I read it",
      mirrorUnknown: "your CV does not say",
      mirrorSkills: (n: number) =>
        n === 1 ? "1 skill kept" : `${n} skills kept`,
      mirrorAsk: (ask: string) =>
        `Give me ${ask}, and I will run the search on every visit.`,
      mirrorAskLink: "Complete my profile",
      answerSubmit: "Confirm",
      answerDontKnow: "I don't know",
      answerUnreadable:
        "I could not read that answer. Rephrase it, or pick one of the options.",
      answerFailed: "I could not save that. Try again.",
      resultsTitle: "What the market has for you",
      resultsLead:
        "The platforms we cover, queried live. Every result leads to the original posting.",
      searching: "Querying the platforms…",
      nudge: (score: number, ask: string) =>
        `Profile at ${score}%. Give us ${ask} and we search better for you.`,
      nudgeLink: "Complete it",
      unconfigured: "No source is enabled yet. There is nothing to search.",
    },
    search: {
      title: "Opportunity search",
      subtitle:
        "What is open right now across the configured platforms. Nothing is stored: every result links to the original posting.",
      queryLabel: "Role you are looking for",
      queryPlaceholder: "Service Designer",
      queryHint: "Leave empty to search the roles inferred from your CV.",
      submit: "Search",
      refine: "Search again with these criteria",
      refineSummary: "Search for something else",
      bandStepUp: (level: string | null) =>
        level ? `The next step — ${level}` : "The next step",
      bandStepUpNote:
        "These roles are one rung above your current level. Your track record says you can defend them.",
      bandLevel: (level: string | null) =>
        level ? `At your level — ${level}` : "At your level",
      searchedAs: (titles: readonly string[]) =>
        `Searched as: ${titles.join(", ")}`,
      searchedAsNote:
        "Platforms do not word roles the way your CV does. These are the titles we searched on your behalf.",
      trajectoryTitle: (current: string, next: string) =>
        `You are ${current}. The next step is ${next}.`,
      trajectoryEvidence: "What in your track record earns it",
      trajectoryMissing: "What a recruiter will look for and not find yet",
      trajectoryQuestions: "What we still need to be sure",
      autoNote:
        "This list was searched for you on arrival, using the roles inferred from your CV. Adjust below if you want something else.",
      // Two messages, not one: "we could not put a search together" and "the
      // search failed" are not fixed the same way.
      openingNoPlan:
        "We could not put a search together for you: your target role is not set yet.",
      openingNoPlanAction: "Pick a role and search",
      openingFailed:
        "The opening search did not go through. Nothing could be queried.",
      openingFailedAction: "Run the search again",
      loading: "Querying the platforms…",
      searching: "Searching…",
      refineLabel: "Refine results",
      engagementLabel: "Engagement type",
      remoteLabel: "Remote",
      notStated: "Not stated",
      ageLabel: "Posted within",
      ageWindow: (days: number) => `${days} days`,
      ageAll: "No limit",
      age: (days: number) =>
        days <= 0
          ? "posted today"
          : days === 1
            ? "posted yesterday"
            : `posted ${days} days ago`,
      ageUnknown: "publication date not provided",
      alsoOn: (names: readonly string[]) => `also on ${names.join(", ")}`,
      countriesLabel: "Countries searched",
      countriesHint: (max: number) =>
        `Up to ${max} countries per search. Each one is an extra query to the sources that split their index by country.`,
      countryLabel: "Country or region",
      placeFilterLabel: "Filter by place",
      countryPlaceholder: "France, Belgium…",
      includeUnstated: "Keep offers that do not state these criteria",
      includeUnstatedNote:
        "Most listings say nothing about contract, remote mode or location. Dropping them would hide good offers over a terse source — we would rather tell you we do not know.",
      unstatedNote: (n: number) =>
        `${n} shown offer${n > 1 ? "s do" : " does"} not state a criterion you filtered on.`,
      sortLabel: "Sort by",
      sortKeys: {
        relevance: "Relevance",
        compensation: "Compensation",
        organization: "Company",
        title: "Job title",
        source: "Source",
      } as Record<string, string>,
      sortDesc: "Descending",
      sortAsc: "Ascending",
      resultCount: (shown: number, total: number) =>
        shown === total
          ? `${total} offer${total > 1 ? "s" : ""} found.`
          : `${shown} of ${total} offers shown.`,
      noneShown:
        "No offer passes your filters. Widen them, or keep the unstated ones.",
      untitled: "Untitled offer",
      noMeta: "No detail stated by the source.",
      scoreLabel: (n: number) => `${n}% match`,
      skillMatch: (matched: number, demanded: number) =>
        `${matched} of your skills, of the ${demanded} asked for`,
      skillMatchNone: (demanded: number) =>
        `None of your confirmed skills among the ${demanded} asked for`,
      skillsUnknown: "This listing does not list skills.",
      compPeriods: {
        year: "yr",
        month: "mo",
        day: "day",
        hour: "hr",
      } as Record<string, string>,
      payConverted: (amount: string, annual: string) =>
        `${amount} · ≈ ${annual}/yr (218 billable days)`,
      openOnSource: "View the original posting",
      unknownFields: (n: number) =>
        `${n} field${n > 1 ? "s" : ""} not stated by the source.`,
      partial: (
        sources: readonly { name: string; failed: number; total: number }[],
      ) => {
        const parts = sources.map((s) =>
          s.failed >= s.total
            ? `${s.name} returned nothing`
            : `${s.name}: ${s.failed} of ${s.total} searches failed`,
        );
        return `Incomplete results — ${parts.join("; ")}.`;
      },
      unconfigured:
        "No legal source is configured. Enable one to run a search.",
      errors: {
        unconfigured: "No legal source is configured.",
        no_keywords: "Type a role, or import your CV so we can infer one.",
        generic: "The search did not go through. Try again.",
      } as Record<string, string>,
    },
    applications: {
      title: "Application tracking",
      subtitle: "Your mission pipeline — from spotted offer to received offer.",
      empty:
        "No tracked application yet. Open an offer and add it to your tracking.",
      followUpsTitle: "Follow-ups due",
      followUpDue: (date: string) => `follow-up due on ${date}`,
      untitled: "Untitled offer",
      open: "Open",
    },
    cvImport: {
      title: "Import my CV",
      note: "Drop your CV (PDF) or paste its text: we detect your skills and you choose which to add. The file is never stored.",
      fileLabel: "CV (PDF)",
      pasteLabel: "…or paste your CV's text",
      pastePlaceholder: "Paste your CV's content here…",
      analyze: "Analyse my CV",
      needInput: "Drop a PDF or paste your CV's text.",
      noneDetected:
        "No known skill detected in this document. You can add them through the interview below.",
      detectedTitle: "Skills detected in your CV",
      detectedNote:
        "Unselect what doesn't fit, then add: your selection is the validation — skills join your profile confirmed and the offer search starts automatically.",
      aiNote:
        "AI also read your CV to spot skills beyond the curated list — check them before adding.",
      chooseOne: "Select at least one skill.",
      addChosen: "Add to my profile",
      back: "Start over",
      added: (n: number) =>
        n === 0
          ? "Those skills were already in your profile."
          : `${n} skill${n > 1 ? "s" : ""} confirmed in your profile.`,
      again: "Import another document",
      applied: (n: number) =>
        `Profile updated — ${n} ${n > 1 ? "items confirmed" : "item confirmed"}.`,
      appliedNote:
        "Your role, summary, core skills and target jobs are in place. Everything stays adjustable in your profile.",
      seeOffers: "Discover my offers",
      understood: {
        title: "Here is what I understood from your career",
        note: "Check it, untick what doesn't fit, then validate in one click — everything stays editable afterwards.",
        roleLabel: "Priority role",
        years: (n: number) => `${n} years of experience`,
        summaryLabel: "Professional summary",
        skillsLabel: "Core skills (recurrent across your experiences)",
        targetsLabel: "Target jobs for offer discovery",
        apply: "That's me — add everything",
        unsureNote:
          "The assistant was not fully sure of its reading — check carefully before validating.",
      },
      linkedin: {
        title: "…or import your LinkedIn export",
        note: "Drop the archive LinkedIn emailed you.",
        fileLabel: "LinkedIn export archive (.zip)",
        analyze: "Analyze my LinkedIn export",
        needFile: "Drop your LinkedIn export archive (.zip).",
        detectedTitle: "Skills detected in your LinkedIn export",
      },
      /** Wording matters: "connect" would promise an OAuth button that does not
       *  exist for this product, "token" states what is actually being asked.
       *  The not-stored sentence is the rule the code enforces, not a courtesy. */
      linkedinApi: {
        title: "…or fill it with LinkedIn",
        note: "LinkedIn will ask for your consent, then send us your positions, education and skills. Nothing is confirmed automatically: you review and validate, just like a CV. Available to EU and Swiss members only.",
        tokenLabel: "LinkedIn access token",
        tokenHelp:
          "The authorization is not kept: it serves this import, then it is gone.",
        portail: "Open the LinkedIn developer portal",
        analyze: "Fill with LinkedIn",
        needToken: "Paste the token generated in the LinkedIn portal.",
        rapportTitle: "What LinkedIn returned",
        rapportVide: "no data",
        rapportLignes: (n: number) => (n === 1 ? "1 record" : `${n} records`),
      },
      errors: {
        empty: "The document looks empty.",
        pdf: "This PDF could not be read. Paste your CV's text instead.",
        linkedin:
          'This archive does not look like a LinkedIn export. Make sure it is the "Get a copy of your data" archive.',
        tooLarge:
          "This file exceeds 10 MB. Export a lighter version or paste your CV's text.",
        generic: "The analysis did not go through. Try again.",
      },
      ats: {
        title: "Readability by recruiting software (ATS)",
        findings: {
          no_extractable_text:
            "Almost no text can be extracted from this PDF — it is likely a scanned image, which most ATS cannot read. Export a real text PDF (not an image).",
          no_sections:
            "No standard section detected (Experience, Skills, Education): an ATS may not know how to split your CV. Add clear section headings.",
          no_contact:
            "No email address detected — an ATS may fail to find your contact details.",
          too_long:
            "This CV is over 3 pages — often too long to be read in full.",
        } as Record<string, string>,
      },
    },
    recommendations: {
      title: "Received recommendations",
      subtitle:
        "Paste a recommendation you received (LinkedIn, email…) and its verification link: it becomes a 'testimonial' proof attached to your profile.",
      listLabel: "Saved recommendations",
      empty: "No recommendation yet. Add one above.",
      verify: "Verify the source",
      noSource: "No verification link",
      backToProfile: "Back to profile",
      error: "Adding it did not go through. Try again.",
      form: {
        recommender: "Who recommends you",
        relationship: "Relationship",
        relationshipPlaceholder: "e.g. former manager, client…",
        organization: "Organisation",
        sourceUrl: "Verification link (recommended)",
        sourceNote:
          "The link (e.g. the LinkedIn recommendation) lets the source be traced and verified. We never fetch anything automatically — you paste the text yourself.",
        text: "Recommendation text",
        submit: "Add the recommendation",
        required: "Enter at least who recommends you and the text.",
      },
    },
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
      gate: { eligible: "Eligible", review: "To check", excluded: "Excluded" },
      gateHint: {
        eligible: "No hard constraint broken, based on known data.",
        review: "Some data is missing to decide certain hard constraints.",
        excluded: "Breaks at least one of your hard constraints.",
      },
      hardConstraints: {
        section: "Hard constraints",
        note: "A deterministic pre-filter from your hard constraints and the extracted (unverified) data — not a recommendation.",
        checks: {
          remote: "Remote",
          engagement_type: "Engagement type",
          minimum_day_rate: "Minimum day rate",
          hard_exclusions: "Exclusions",
          allowed_regions: "Allowed work regions",
        },
        verdicts: {
          pass: "OK",
          violated: "Broken",
          unknown: "Undetermined",
          not_constrained: "Not constrained",
        },
        excludedTerm: (term: string) => `Excluded term found: “${term}”`,
      },
      dayRate: {
        section: "Indicative freelance day rate",
        range: (low: number, high: number, currency: string) =>
          `~${low.toLocaleString("en-US")} to ~${high.toLocaleString("en-US")} ${currency}/day`,
        note: "Estimated from the advertised salary: ÷ 218 billable days, × 1.5 to 2 for a freelance profile (social charges, leave, gaps between contracts, risk). Refine for your situation — it's a benchmark, not a guarantee.",
      },
      matchScore: {
        section: "Match score",
        note: "A deterministic score from your preferences and confirmed skills — indicative, not a recommendation.",
        overall: (n: number) => `${n} / 100`,
        none: "Not enough data to score.",
        confidenceLabel: "Confidence:",
        confidence: {
          none: "—",
          low: "low",
          medium: "medium",
          high: "high",
        },
        components: {
          skills: "Skills",
          rate: "Day rate",
          remote: "Remote",
          engagement: "Engagement type",
        },
        unscored: "—",
        matchedSkills: "Covered skills",
      },
      discover: {
        button: "Discover offers",
        searching: "Searching…",
        result: (
          imported: number,
          duplicates: number,
          failed: number,
          incomplete = false,
        ) => {
          const found = imported + duplicates + failed;
          if (found === 0)
            return incomplete
              ? "No offer retrieved this time."
              : "No offer found for your profile this time.";
          const parts = [`${imported} new`, `${duplicates} already known`];
          if (failed > 0)
            parts.push(`${failed} ad${failed > 1 ? "s" : ""} not imported`);
          return `${found} ${found > 1 ? "offers" : "offer"} found: ${parts.join(", ")}.`;
        },
        partial: (
          sources: readonly { name: string; failed: number; total: number }[],
        ) => {
          const parts = sources.map((s) =>
            s.failed >= s.total
              ? `${s.name} returned nothing (${s.total} search${s.total > 1 ? "es" : ""} failed)`
              : `${s.name}: ${s.failed} of ${s.total} searches failed`,
          );
          return `(Incomplete results — ${parts.join("; ")}. If this persists, check that source's configuration.)`;
        },
        errors: {
          unconfigured:
            "Auto-discovery is not enabled yet (no legal source configured).",
          no_keywords:
            "Confirm a role or skills in your profile first (or import your CV) to guide the search.",
          generic: "The search did not go through. Try again.",
        },
        unconfiguredNote:
          "Auto-discovery: add legal-source credentials (Adzuna, France Travail, Remotive, Himalayas or Jobicy) in the configuration so MissionPilot can search offers matching your profile.",
      },
      insight: {
        button: "Explain my matches (AI)",
        analyzing: "Analyzing your best offers…",
        whyTitle: "Why this match",
        fit: {
          strong: "Strong match",
          good: "Good match",
          weak: "Weak match",
        } as Record<string, string>,
        strengths: "Strengths",
        gaps: "Watch out for",
        needsReview:
          "Uncertain analysis — the AI lacks elements, read with caution.",
        result: (analyzed: number, failed: number) => {
          if (analyzed === 0 && failed === 0)
            return "All your best offers are already analyzed.";
          const parts = [
            `${analyzed} offer${analyzed > 1 ? "s" : ""} analyzed`,
          ];
          if (failed > 0) parts.push(`${failed} failed (try again later)`);
          return `${parts.join(", ")}.`;
        },
        errors: {
          unconfigured:
            "Match explanations are not enabled yet (OpenAI key missing).",
          no_profile:
            "Confirm your profile first (role, skills) — import your CV to go fast.",
          no_candidates:
            "No offer can be analyzed — your offers are excluded by your constraints or have no text.",
          busy: "An analysis is already running — hang on a moment.",
          generic: "The analysis did not go through. Try again.",
        },
      },
      breakdown: {
        title: "Match breakdown (AI)",
        note: "Every requirement of the offer checked against your validated profile, with an honest tip to improve your CV where relevant. It's a proposal — never an invitation to make things up.",
        empty:
          "Run the detailed analysis to see, requirement by requirement, what your profile covers and how to strengthen your CV.",
        button: "Analyze in detail",
        analyzing: "Analyzing…",
        refreshCta: "Re-analyze",
        importance: {
          must: "Must-have",
          nice: "Nice-to-have",
        } as Record<string, string>,
        status: {
          covered: "Covered",
          partial: "Partial",
          missing: "Missing",
        } as Record<string, string>,
        suggestionLabel: "Tip",
        needsReview:
          "Uncertain analysis — the AI lacks elements, read with caution.",
        errors: {
          unconfigured:
            "The detailed analysis is not enabled yet (OpenAI key missing).",
          no_profile:
            "Confirm your profile first (role, skills) — import your CV to go fast.",
          not_found: "This offer does not have enough content to analyze.",
          generic: "The analysis did not go through. Try again.",
        },
      },
      application: {
        section: "Prepare my application",
        note: "A draft grounded in your validated profile: review it, fill the [brackets] with your real figures, then send it yourself from the offer's site. MissionPilot never sends anything on your behalf.",
        empty:
          "Generate a cover letter tailored to this offer, plus your strengths to highlight.",
        button: "Prepare my application",
        generating: "Preparing…",
        refreshCta: "Regenerate",
        coverLabel: "Cover letter (editable draft)",
        highlightsLabel: "Points to highlight",
        copy: "Copy the letter",
        copied: "Copied!",
        needsReview:
          "Uncertain draft — the AI lacks elements, review carefully.",
        errors: {
          unconfigured:
            "Application preparation is not enabled yet (OpenAI key missing).",
          no_profile:
            "Confirm your profile first (role, skills) — import your CV to go fast.",
          not_found:
            "This offer does not have enough content to prepare an application.",
          generic: "The preparation did not go through. Try again.",
        },
      },
      interview: {
        section: "Prepare the interview",
        note: "The likely questions for this offer, with the experience from your profile to draw on. Preparation material — not a script, and no guarantee of outcome.",
        empty:
          "Generate your interview brief: likely questions and points to raise.",
        button: "Prepare the interview",
        preparing: "Preparing…",
        refreshCta: "Regenerate",
        questionsLabel: "Likely questions",
        talkingPointsLabel: "Points to raise",
        needsReview:
          "Uncertain brief — the AI lacks elements, read with caution.",
        errors: {
          unconfigured:
            "Interview preparation is not enabled yet (OpenAI key missing).",
          no_profile:
            "Confirm your profile first (role, skills) — import your CV to go fast.",
          not_found:
            "This offer does not have enough content to prepare an interview.",
          generic: "The preparation did not go through. Try again.",
        },
      },
      tracking: {
        section: "Application tracking",
        note: "Track this offer in your pipeline. This stays private.",
        stageLabel: "Stage",
        stages: {
          saved: "Saved",
          prepared: "Prepared",
          applied: "Applied",
          interview: "Interview",
          offer: "Offer",
          rejected: "Rejected",
        } as Record<string, string>,
        noteLabel: "Note",
        notePlaceholder: "Contact, next steps, impressions…",
        followUpLabel: "Follow up on",
        save: "Save tracking",
        saved: "Saved",
        untrack: "Remove from tracking",
        error: "Saving did not go through. Try again.",
      },
      inbox: {
        all: "All",
        empty: "No opportunity in this filter.",
        filterLabel: "Filter opportunities",
        gateLabel: "Filter by eligibility",
        typeLabel: "Filter by engagement type",
        allTypes: "All types",
        remoteLabel: "Filter by remote",
        allRemotes: "Any remote mode",
      },
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
        sourceName: "Source",
        sourceUrl: "Source link",
        viewOnSource: "View the original posting",
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
