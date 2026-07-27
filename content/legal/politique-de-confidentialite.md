# MissionPilot — Politique de confidentialité

**Version 1.0** — dernière mise à jour et entrée en vigueur : **27 juillet 2026**

Service concerné : https://missionpilot.net
Code source, lisible publiquement : https://github.com/Christophevanengelen/missionpilot

---

## En un paragraphe

MissionPilot cherche des offres d'emploi pour vous. Pour cela, il lit votre CV. **Nous ne conservons pas le fichier** : nous le lisons en mémoire, puis nous envoyons son texte entier à **OpenAI, la société américaine qui édite ChatGPT**, pour en tirer un rôle, une séniorité, un résumé et des compétences. Nous enregistrons ces affirmations ; nous n'enregistrons pas le CV. **Nous n'écrivons aucune offre en base de données** : nous les cherchons et nous les affichons à la volée. Les plateformes d'offres reçoivent des intitulés de métier et des codes pays, jamais votre nom ni votre CV. **Nous n'envoyons aucune candidature en votre nom.** Vous supprimez votre compte depuis votre profil : la suppression est immédiate et définitive.

---

## Comment lire ce document

Ce document décrit ce que le service fait réellement de vos données. Il est écrit pour être relu avec le code sous les yeux : le code est public, et chaque affirmation technique ci-dessous s'y vérifie.

MissionPilot a une règle : on n'affirme jamais comme un fait ce qu'on n'a pas constaté. Cette politique suit la même règle. Là où nous ne savons pas encore, nous l'écrivons en toutes lettres plutôt que de combler. Vous trouverez donc dans ce document des phrases qui commencent par « nous n'avons pas encore vérifié ». Elles sont volontaires : une politique de confidentialité qui n'a aucun trou est presque toujours une politique qui n'a pas été relue contre le code.

---

## 1. Ce que nous devons vous dire avant tout le reste

Quatre points. Ils sont exacts, ils ne nous arrangent pas, et ils sont ici plutôt qu'en bas de page.

**1.1 — Le texte de votre CV part entier chez OpenAI, aux États-Unis.**
Nous n'anonymisons rien et nous ne masquons rien avant l'envoi. Votre nom, vos coordonnées, vos employeurs et vos dates partent avec le reste. La seule limite est technique : les 30 000 premiers caractères, soit une quinzaine de pages — en pratique, votre CV en entier. Détail complet en section 9.

**1.2 — Un modèle d'OpenAI écarte des offres avant que vous ne les voyiez.**
Le tri automatique ne fait pas qu'ordonner : quand le modèle rend un verdict négatif sur une offre, cette offre n'apparaît pas dans votre liste. Le biais est volontairement dissymétrique — **nous affichons une offre sauf si le modèle a explicitement demandé de l'écarter**. Un verdict manquant, une réponse tronquée, une panne : dans chacun de ces cas, nous affichons l'offre. Détail complet en section 18.

**1.3 — Vous ne pouvez pas effacer une affirmation ou une preuve prise isolément depuis l'interface.**
Vous pouvez rejeter une affirmation : elle cesse d'être utilisée et disparaît de votre profil. Sa valeur reste enregistrée. L'effacement matériel passe par la suppression de votre compte, ou par une demande à cve@hi-def.be. Corriger une affirmation n'efface pas l'ancienne valeur : cela en ajoute une nouvelle, chaînée à la précédente.

**1.4 — Nous ne recueillons pas aujourd'hui de consentement distinct pour les données sensibles d'un CV.**
Un CV mentionne souvent, sans que son auteur y ait pensé, une interruption de carrière pour raison de santé, un mandat syndical, un engagement confessionnel ou politique, une nationalité. Ces mentions relèvent de l'article 9 du RGPD. Nous ne vous demandons aucune donnée de cette nature, et aucun champ du produit ne l'appelle — mais rien dans le produit ne les détecte ni ne les écarte, et aucune case de consentement dédiée n'existe à l'écran de dépôt. Tant que ce n'est pas le cas, retirez ces mentions de votre CV avant de le déposer. Détail complet en section 13.

---

## 2. Qui traite vos données

**Responsable du traitement** (art. 13(1)(a)) :

|                               |                                               |
| ----------------------------- | --------------------------------------------- |
| Dénomination légale           | **Productions Associées** (ASBL / VZW)        |
| Nom commercial                | **Smart**                                     |
| Numéro d'entreprise et de TVA | 0896.755.397 — BE 0896.755.397                |
| Siège                         | Rue Coenraets 72, 1060 Saint-Gilles, Belgique |
| Contact pour ce projet        | **cve@hi-def.be**                             |

« Hi-DEF » est le nom du projet MissionPilot et le domaine de l'adresse de contact. Ce n'est pas une société, et ce n'est pas le responsable du traitement.

Le responsable du traitement est établi en Belgique. Aucun représentant au sens de l'art. 27 RGPD n'est requis ni désigné.

**Délégué à la protection des données** (art. 13(1)(b)) : aucun délégué à la protection des données n'est désigné pour MissionPilot. Adressez toute demande relative à vos données à **cve@hi-def.be**, ou par courrier à Productions Associées ASBL — MissionPilot, Rue Coenraets 72, 1060 Saint-Gilles, Belgique.

---

## 3. Ce que nous enregistrons

Tout ce qui suit est enregistré chez **Supabase**, qui héberge notre base de données et gère votre connexion. Chaque table porte une règle de sécurité au niveau de la ligne : la base elle-même refuse de rendre vos lignes à quelqu'un d'autre, indépendamment du code de l'application. Ces règles sont actives sur les 16 tables du schéma.

| Ce qui est enregistré                                                    | Contenu exact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | D'où cela vient                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Votre compte** _(géré par Supabase Auth)_                              | Votre adresse e-mail. Pour les comptes qui ont un mot de passe, son empreinte, détenue par Supabase — l'application n'en crée aucun et n'y accède jamais.                                                                                                                                                                                                                                                                                                                                                                                             | Vous                                                                                   |
| **Votre profil et vos préférences** _(`candidate_profiles`)_             | Un nom d'affichage, **pré-rempli automatiquement avec la partie de votre adresse e-mail située avant le `@`** — vous le modifiez quand vous voulez. Puis : métiers visés, types de mission, langues, régions de travail acceptées, exclusions fermes, tarif journalier visé et minimum, devise, position sur le télétravail, chevauchement d'horaires accepté avec un autre fuseau, disposition à vous déplacer.                                                                                                                                      | Vous                                                                                   |
| **Vos affirmations de parcours** _(`profile_claims`)_                    | Rôle, séniorité, années d'expérience, résumé, compétences, réalisations. Chacune porte un état — proposée, confirmée, à revoir, rejetée — et une origine : vous, ou « l'assistant », c'est-à-dire le modèle d'OpenAI décrit en section 9.                                                                                                                                                                                                                                                                                                             | Votre CV, votre import LinkedIn, ou votre saisie                                       |
| **Vos preuves** _(`evidence_items`)_                                     | Réalisations, éléments de portfolio, et **recommandations reçues** : nom de l'auteur (200 caractères), sa relation avec vous, son organisation, son texte (5 000 caractères) et, si vous l'ajoutez, un lien de vérification (1 000 caractères). Ces preuves viennent uniquement de votre saisie : nous n'allons chercher aucune recommandation nulle part. **Elles contiennent des données concernant d'autres personnes** — voir section 7.                                                                                                          | Vous, en collant ce que vous avez reçu                                                 |
| **Les liens entre preuves et affirmations** _(`claim_evidence_links`)_   | Quelle preuve étaye quelle affirmation, depuis quand. Détacher une preuve ne supprime rien : cela date le détachement et enregistre le motif que vous écrivez, jusqu'à 500 caractères.                                                                                                                                                                                                                                                                                                                                                                | Vous                                                                                   |
| **Vos réponses aux questions du produit** _(`profile_clarifications`)_   | La question posée, reprise mot pour mot, votre réponse (2 000 caractères), ou le fait que vous ayez passé la question.                                                                                                                                                                                                                                                                                                                                                                                                                                | Vous                                                                                   |
| **Vos versions de profil enregistrées** _(`profile_versions`)_           | Un instantané figé de vos affirmations confirmées et du contenu des preuves liées, au moment où vous le publiez. Ces instantanés sont **visibles de vous seul** : nous ne les publions nulle part et ne les transmettons à aucun employeur. Aucun rôle applicatif ne peut les modifier.                                                                                                                                                                                                                                                               | Dérivé de ce qui précède                                                               |
| **Les traces de vérification technique** _(`agent_runs`, `agent_steps`)_ | Nom du traitement, horodatages, statut, durée, coût estimé, nom du fournisseur et du modèle, et **une empreinte** de l'entrée et de la sortie : une suite de caractères calculée à partir du contenu, dont on ne peut pas revenir au contenu. Le contenu lui-même n'y est jamais recopié. Deux colonnes accueillent un texte d'erreur technique libre : la réserve de la section 19 s'y applique. Ces tables sont en ajout seul : aucune ligne ne peut y être modifiée ni effacée une par une, par aucun rôle. Elles ne partent qu'avec votre compte. | Le système, uniquement quand vous lancez une vérification depuis la page de diagnostic |
| **Les résultats de vérification technique** _(`system_health_results`)_  | Votre identifiant interne, un horodatage, deux indicateurs techniques (la base répond, l'IA répond), une clé qui empêche d'exécuter deux fois la même vérification, et un champ de détail technique. Aucune donnée de profil.                                                                                                                                                                                                                                                                                                                         | Le même bouton de diagnostic                                                           |

**Sept tables restent vides.** Le schéma comporte des tables héritées d'une version antérieure du produit : des offres et leurs captures brutes, un suivi de candidature avec ses notes (4 000 caractères), des lettres de motivation (6 000 caractères), des préparations d'entretien, des analyses d'adéquation entre un profil et une offre. Aucun écran de l'application ne les remplit, et elles sont vides. Nous écrivons « elles restent vides », et non « elles ne pourraient pas se remplir » : le code de persistance existe, il n'est relié à aucune interface. Si cela change, cette page change avec.

**Une garantie que la loi n'exige pas.** Nous ne réécrivons jamais la valeur d'une affirmation. Quand vous corrigez « Directeur artistique » en « Directeur de création », nous ajoutons une ligne et nous la chaînons à l'ancienne ; l'ancienne reste, marquée comme remplacée, et vous la consultez depuis l'historique de votre profil. L'application n'a pas le droit d'écraser une valeur. Le rôle d'administration technique, lui, conserve un droit de modification et de suppression : c'est par lui que passe une demande d'effacement.

---

## 4. Ce que nous n'enregistrons pas

**Le fichier de votre CV.** Nous lisons le PDF en mémoire (10 Mo et 80 pages au maximum), nous en extrayons le texte, et nous n'écrivons le fichier sur aucun disque. Cela ne veut pas dire que votre CV ne quitte pas nos serveurs — voir le point 1.1.

**Votre archive LinkedIn.** Nous décompressons le fichier ZIP en mémoire et nous ne l'écrivons nulle part.

**Votre jeton d'accès LinkedIn.** Nous ne le stockons pas et nous ne l'écrivons dans aucun journal. Il existe le temps de l'import, dans la mémoire du serveur. Aucune colonne de notre base n'est prévue pour le recevoir et aucun code ne l'y écrit. Nous ne lisons jamais le contenu de ce que LinkedIn nous renvoie en cas d'erreur, précisément pour qu'il ne finisse pas dans un message d'erreur.

**Le texte de parcours reconstitué à partir de LinkedIn.** Seules les affirmations qui en découlent sont enregistrées.

**Les offres que vous consultez.** Nous ne les écrivons dans aucune table de la base : ni leur texte, ni leur titre, ni l'entreprise, ni le lien.

**Aucun outil de mesure d'audience, aucun traceur publicitaire, aucun outil de suivi comportemental.** Ni Google Analytics, ni Vercel Analytics, ni PostHog, ni Sentry, ni Plausible, ni Mixpanel, ni Segment, ni Datadog. Cela se vérifie en trente secondes dans les dépendances du projet.

**Une réserve, parce qu'elle est vraie.** « Non enregistré » ne veut pas dire « évaporé à la seconde ». Deux caches vivent dans la mémoire du serveur, sans jamais rien écrire sur disque :

- le dossier professionnel qui sert à construire votre plan de recherche, **une heure** ;
- les réponses de certaines plateformes d'offres, **de trente minutes à six heures selon la source** — ces plateformes nous demandent de ne pas les interroger plus souvent. Ce cache est indexé sur la requête, pas sur vous.

Ces caches sont vidés au redémarrage du service.

---

## 5. Votre CV, étape par étape

C'est le moment qui compte le plus. Voici ce qui se passe, dans l'ordre.

1. Vous déposez un PDF, ou vous collez du texte.
2. **Nous lisons le fichier en mémoire** et nous en extrayons le texte. Nous ne l'écrivons sur aucun disque, ni sur les nôtres, ni sur ceux de Supabase.
3. **Nous envoyons les 30 000 premiers caractères de ce texte à OpenAI, aux États-Unis**, en un appel. Si cet appel échoue, un second appel, plus étroit, tente d'en extraire les seules compétences.
4. OpenAI nous renvoie sept éléments, et sept seulement : un intitulé de rôle, une justification de ce choix (500 caractères), un niveau de séniorité, un nombre d'années d'expérience, un résumé de deux à trois phrases (2 000 caractères), quinze compétences cœur au plus, et trois métiers cibles au plus.
5. Nous vous montrons ce résultat. Vous retirez les compétences qui ne vous vont pas, une par une. Le rôle, la séniorité, les années, le résumé et les métiers cibles ne se modifient pas sur cet écran : votre clic les valide en bloc. Tant que vous n'avez pas cliqué, rien n'est écrit en base.
6. Après enregistrement, vous corrigez ce que vous voulez depuis votre profil. Une correction ajoute une ligne et n'efface pas la précédente.
7. **Nous n'enregistrons nulle part le texte de votre CV.** Seules les affirmations validées sont écrites.

**Nous n'anonymisons rien et nous ne masquons rien avant l'envoi.** Le texte part entier : votre nom, votre numéro de téléphone, votre adresse e-mail, vos employeurs, vos dates. Écrire le contraire serait faux.

---

## 6. L'import LinkedIn

Deux chemins, et ils ne se comportent pas de la même façon.

### 6.1 Par l'API LinkedIn (Member Data Portability)

Vous autorisez MissionPilot dans l'interface de LinkedIn, sur l'autorisation `r_dma_portability_3rd_party` — l'autorisation qui permet à une application tierce de recevoir vos données. LinkedIn nous les transmet ensuite.

**Source des données** (art. 14(2)(f)) : **LinkedIn**, via la **Member Data Portability API**. Ces données ne proviennent pas de sources accessibles au public : elles viennent de votre compte LinkedIn, et vous seul déclenchez leur transmission. Nous ne pratiquons aucune collecte automatisée — ni _scraping_, ni _crawling_, ni _spidering_.

**Catégories de données que nous demandons** (art. 14(1)(d)) — **six domaines, pas davantage.** L'API LinkedIn en expose 65 ; nous n'appelons que ceux-ci :

| Domaine                  | Ce qu'il contient                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROFILE`                | Votre profil tel que vous l'avez rempli                                                                                                                                    |
| `POSITIONS`              | Vos postes : intitulés, organisations, périodes                                                                                                                            |
| `EDUCATION`              | Votre formation                                                                                                                                                            |
| `SKILLS`                 | Vos compétences déclarées                                                                                                                                                  |
| `RECOMMENDATIONS`        | Les recommandations que vous avez reçues, avec le nom, la fonction et l'organisation de leur auteur — dix au plus, et uniquement celles qui sont publiées sur votre profil |
| `JOB_SEEKER_PREFERENCES` | Vos préférences de recherche déclarées sur LinkedIn : postes visés, lieux visés, secteurs visés, types de poste, taille d'entreprise                                       |

**Quand la collecte a lieu** : au moment où vous validez l'autorisation chez LinkedIn, et à ce moment seulement. Il n'y a aucune synchronisation continue.

**Ce que nous en faisons.** Nous assemblons un texte de parcours à partir de ces six domaines, et **nous envoyons ce texte à OpenAI, aux États-Unis**, exactement comme un CV. Nous en tirons un rôle, une séniorité, un nombre d'années, un résumé et jusqu'à trente compétences.

**Ce texte contient les recommandations écrites sur vous par d'autres personnes**, avec leur nom, leur fonction et leur organisation. Ces données de tiers partent donc chez OpenAI au même titre que les vôtres. Nous ne les enregistrons pas : seules les affirmations dérivées sont écrites en base.

**Rien n'est confirmé d'office.** Par ce chemin, les affirmations sont déposées à l'état **« proposé »**, d'origine « assistant ». Elles n'entrent dans votre profil qu'après votre validation.

### 6.2 Par l'archive que LinkedIn vous fournit

Vous téléchargez votre propre export officiel chez LinkedIn et vous nous le déposez. **Nous décompressons l'archive en mémoire et nous ne l'écrivons nulle part.** Nous y lisons six fichiers : `profile.csv`, `positions.csv`, `skills.csv`, `education.csv`, `recommendations_received.csv`, `job seeker preferences.csv`.

La lecture est la même qu'au point 6.1, et l'envoi à OpenAI aussi. Le dépôt diffère : l'archive passe par l'écran de restitution de la section 5, et ce que vous y validez est enregistré **confirmé**, exactement comme pour un CV.

### 6.3 Le jeton, le retrait, et ce que LinkedIn ne garantit pas

**Le jeton d'accès** : voir section 4. Nous ne le stockons pas et nous ne le journalisons pas.

**Retirer votre autorisation.** Chez LinkedIn, à tout moment : _Paramètres et confidentialité → Confidentialité des données → Services autorisés_. Le retrait coupe tout accès futur. Il vaut pour l'avenir et ne remet pas en cause ce qui a été traité avant. Les affirmations déjà enregistrées subsistent jusqu'à ce que vous en demandiez l'effacement — ce que le retrait du consentement vous donne le droit d'obtenir (art. 17(1)(b)) : rejetez-les depuis votre profil pour qu'elles cessent d'être utilisées, écrivez-nous pour qu'elles soient effacées, ou supprimez votre compte (section 14).

**MissionPilot n'affirme pas, et ne laisse pas entendre, que LinkedIn a vérifié ou confirmé l'exactitude de ces données.** LinkedIn nous transmet ce que vous y avez écrit.

**Disponibilité** : LinkedIn réserve ce consentement aux membres situés dans l'Espace économique européen, d'après la localisation figurant dans leur profil LinkedIn. La documentation de LinkedIn se contredit sur l'inclusion de la Suisse pour ce produit ; nous ne l'affirmons donc ni dans un sens ni dans l'autre.

---

## 7. Les données qui concernent d'autres personnes que vous

Quand vous collez une recommandation reçue, ou quand vous importez votre parcours LinkedIn, vous nous transmettez des données concernant **son auteur** : son nom, sa fonction ou sa relation avec vous, son organisation, et le texte qu'il a écrit.

Ce que nous en faisons :

- **Recommandation collée** : nous l'enregistrons dans votre bibliothèque de preuves. Elle sert uniquement à étayer votre profil. Nous ne l'envoyons pas à OpenAI : le dossier professionnel décrit en section 9 ne contient pas vos preuves.
- **Recommandation reçue de LinkedIn** : elle entre dans le texte de parcours et **part chez OpenAI**, attribuée à son auteur (section 6.1). Nous ne l'enregistrons pas.

Dans les deux cas : nous ne les publions jamais, nous ne les transmettons à aucun employeur, nous ne les utilisons pour créer le profil de personne, et nous ne les recoupons avec aucune autre source.

**Base légale** : notre intérêt légitime (art. 6(1)(f)) à vous permettre de documenter votre parcours par les appréciations que vous avez reçues. La mise en balance tient compte du fait que ces données ne sont ni publiées, ni transmises à un employeur, ni utilisées pour profiler leur auteur.

**Votre responsabilité** : ne déposez une recommandation que si vous êtes en droit de la conserver, et retirez-en ce qui excède le nécessaire.

**Si vous êtes l'auteur d'une recommandation** enregistrée ici par la personne qu'elle concerne : le responsable du traitement est Productions Associées (section 2), la source de vos données est cette personne, la finalité est celle décrite ci-dessus, la durée est celle de la section 14, et vous disposez des droits de la section 15. Écrivez à **cve@hi-def.be** : nous répondons dans le mois. Nous n'informons pas aujourd'hui individuellement les auteurs de recommandations ; cette section est l'information que nous rendons publiquement disponible.

---

## 8. Les offres : ce qui sort de chez nous

Nous interrogeons sept plateformes, nommées une par une : **Adzuna, France Travail, Himalayas, Jobicy, Remotive, Remote OK et Recruitee**.

**Ce qui part vers elles :**

- **des intitulés de métier — jusqu'à douze par recherche**, chacun interrogé séparément : six au niveau que vous occupez et six au niveau au-dessus, produits par l'analyse de vocabulaire à partir de votre dossier. À défaut de dossier, jusqu'à trois métiers cibles que vous avez déclarés, ou votre intitulé de rôle confirmé et vos compétences confirmées (quatre termes au plus). Chaque requête est plafonnée à cinq mots. Ces intitulés vous sont montrés à l'écran ;
- **les mots que vous tapez vous-même** dans la recherche ;
- **les codes des pays que vous avez déclarés comme régions de travail acceptées**, trois au plus, pour Adzuna et Himalayas — les autres sources n'en reçoivent aucun.

**Ce qui ne part pas** : votre nom, votre adresse e-mail, votre identifiant, votre CV, votre adresse précise, votre tarif. L'adresse IP que ces plateformes voient est celle de notre serveur, pas la vôtre.

Remote OK et Recruitee ne reçoivent **aucun paramètre** : nous récupérons leur flux complet et nous filtrons chez nous.

Cela vaut pour nos recherches. Quand vous ouvrez une annonce, c'est votre navigateur qui va chez son éditeur, et c'est votre adresse IP qu'il voit.

Nous nommons ces sept plateformes comme destinataires parce que les intitulés envoyés sont dérivés de votre profil, même si rien de ce que nous leur transmettons ne permet de vous identifier.

---

## 9. Ce que nous envoyons à OpenAI

**Nous transmettons des données à OpenAI**, à l'adresse `https://api.openai.com/v1/chat/completions`. Voici exactement quoi, tâche par tâche.

| Traitement                                  | Ce que nous envoyons                                                                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lecture de votre CV                         | **Le texte intégral de votre CV**, tronqué à 30 000 caractères                                                                                                                                                          |
| Extraction de compétences (chemin de repli) | Le même texte                                                                                                                                                                                                           |
| Lecture de votre parcours LinkedIn          | Le texte de parcours reconstitué, **recommandations attribuées comprises**                                                                                                                                              |
| Tri des offres                              | Votre dossier professionnel, tronqué à 6 000 caractères, et **les 25 premières offres du classement** — pour chacune : intitulé, entreprise, et un extrait de 900 caractères. Les offres suivantes ne sont pas envoyées |
| Analyse de trajectoire de carrière          | Votre dossier professionnel, tronqué à 12 000 caractères                                                                                                                                                                |
| Vocabulaire du métier sur le marché         | Votre dossier professionnel, tronqué à 8 000 caractères                                                                                                                                                                 |

Le **dossier professionnel** contient : votre rôle, votre séniorité, vos années d'expérience, votre résumé, vos compétences confirmées, vos métiers cibles, **et vos réponses aux questions du produit accompagnées des questions correspondantes, les unes et les autres reprises mot pour mot**. Si vous avez répondu « j'ai arrêté six mois en 2022 pour raisons familiales », cette phrase part telle quelle, avec la question qui l'a appelée.

**Nous n'anonymisons rien et nous ne masquons rien avant l'envoi.**

**Nous n'entraînons aucun modèle d'intelligence artificielle sur vos données.** Aucun dispositif d'entraînement n'existe dans le code, et nous n'en avons pas le projet. Ce qu'OpenAI fait des données que nous lui envoyons ne dépend pas de nous seuls. Deux réglages sont vérifiés sur notre compte, et vous pouvez nous demander une capture : le partage des entrées et sorties avec OpenAI à des fins d'amélioration de ses modèles est **désactivé**, ainsi que le partage des données d'évaluation et des retours. Nos requêtes précisent en outre `store: false`, ce qui demande à OpenAI de ne pas les conserver pour consultation. **Ce que nous n'avons pas encore établi**, et que nous ne prétendrons donc pas : la durée de rétention exacte qu'OpenAI applique malgré cela pour sa surveillance des abus, l'entité juridique avec laquelle nous avons contracté, et l'existence d'un accord de sous-traitance signé au sens de l'art. 28. Tant que ces trois points ne sont pas documentés ici, considérez que le texte de votre CV a été traité aux États-Unis sans garantie contractuelle vérifiée par nos soins.

Cette analyse fonctionne parce que le service est configuré avec OpenAI — c'est le cas sur le déploiement de production, vérifié le 27 juillet 2026. Si vous installez ce code vous-même sans clé OpenAI, rien n'est envoyé à personne : le service se replie sur un calcul local, moins fin.

---

## 10. Qui reçoit vos données (art. 13(1)(e))

Nous nommons chaque destinataire. Nous n'écrivons pas « des prestataires ».

| Destinataire                                                                  | Ce qu'il reçoit                                                                                                                                                                                                                                                                  | À quel titre                                                                                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **OpenAI**                                                                    | Ce qui figure en section 9                                                                                                                                                                                                                                                       | Sous-traitant : il traite sur nos instructions, pour nos seules finalités, sous contrat au sens de l'art. 28 RGPD |
| **Supabase**                                                                  | Toutes les données de la section 3. C'est notre base de données, notre système d'authentification, l'émetteur de vos cookies de session et l'expéditeur de vos liens de connexion — aucun autre service d'e-mail n'intervient                                                    | Sous-traitant (art. 28)                                                                                           |
| **Vercel**                                                                    | Tout ce qui transite entre votre navigateur et nous, le temps du passage, plus les journaux serveur. Nous nommons Vercel sur la foi de l'adresse de déploiement `missionpilot.vercel.app`, qui reste un alias du service, et non sur la foi du dépôt, qui ne le nomme nulle part | Sous-traitant (art. 28)                                                                                           |
| **Inngest**                                                                   | Un seul message, pour la vérification technique : votre identifiant interne et un code qui empêche d'exécuter deux fois la même vérification. **Aucun contenu**                                                                                                                  | Sous-traitant (art. 28)                                                                                           |
| **Adzuna, France Travail, Himalayas, Jobicy, Remotive, Remote OK, Recruitee** | Ce qui figure en section 8                                                                                                                                                                                                                                                       | Destinataires                                                                                                     |

**Nous ne vendons vos données à personne. Nous ne les louons pas, nous ne les cédons pas, nous ne les partageons avec aucun annonceur, aucun courtier en données, aucun recruteur.**

Nous ne transmettons de données à une autorité que sur réquisition légale à laquelle nous sommes tenus de répondre, et nous vous en informons sauf interdiction légale.

---

## 11. Transferts en dehors de l'Union européenne (art. 13(1)(f))

### 11.1 OpenAI

**Nous transmettons à OpenAI, établie aux États-Unis d'Amérique**, les données décrites en section 9 : le texte intégral de votre CV, le texte de votre parcours LinkedIn, votre dossier professionnel et les offres à trier. Nous n'avons pas encore établi avec quelle entité juridique d'OpenAI nous avons contracté, et nous ne le devinerons pas ici.

**Décision d'adéquation.** Les États-Unis ne font pas l'objet d'une décision d'adéquation générale. Il existe une décision d'adéquation limitée — le **EU-U.S. Data Privacy Framework**, décision d'exécution (UE) 2023/1795 du 10 juillet 2023 — qui ne couvre que les organisations américaines certifiées à ce titre. **Nous ne fondons pas ce transfert sur elle.**

**Garanties.** Nous ne pouvons pas encore affirmer que ce transfert est couvert par les clauses contractuelles types de la Commission européenne, ni par une autre garantie de l'article 46 : nous n'avons pas vérifié le contrat qui nous lie à OpenAI. Nous nous l'interdisons plutôt que de recopier une phrase que tout le monde écrit. C'est le premier point que nous devons régler, et il est ouvert.

**Comment en obtenir copie.** Écrivez à **cve@hi-def.be** : nous vous en adressons copie dans le mois.

### 11.2 LinkedIn

Les données que vous importez depuis LinkedIn nous parviennent à votre demande, sur la base du consentement que vous exprimez chez LinkedIn. Nous ne savons pas quel mécanisme LinkedIn applique en interne ; sa propre politique de confidentialité le décrit.

### 11.3 Notre infrastructure

Supabase, Vercel et Inngest sont des sociétés américaines.

**Ce que nous avons vérifié.** La base de données qui contient votre profil est hébergée dans la région **West EU (Irlande)** — constaté dans la console Supabase le 27 juillet 2026. Vos données de profil sont donc stockées dans l'Union européenne.

**Ce que nous n'avons pas encore établi**, et que nous ne comblerons pas par une formule : la région d'exécution des fonctions applicatives chez Vercel, la région d'Inngest, l'entité juridique figurant sur chacun de ces contrats, et le mécanisme de transfert souscrit avec chacune. Tant que ces points ne sont pas documentés ici, considérez qu'un accès depuis les États-Unis par le personnel de ces sociétés est possible.

---

## 12. Finalités et bases juridiques (art. 13(1)(c) et (d))

| Traitement                                                                            | Finalité                                                                                      | Base juridique                                                                                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Création du compte, connexion                                                         | Vous identifier et vous donner accès à votre profil                                           | **Art. 6(1)(b)** — exécution du contrat                                                                                              |
| Nom d'affichage dérivé de votre adresse e-mail                                        | Vous adresser un libellé lisible dès la première connexion plutôt qu'un identifiant technique | **Art. 6(1)(f)** — intérêt légitime. Vous le modifiez quand vous voulez                                                              |
| Enregistrement de votre profil, de vos préférences, de vos preuves et de vos réponses | Constituer le dossier à partir duquel la recherche est faite                                  | **Art. 6(1)(b)**                                                                                                                     |
| Lecture de votre CV par OpenAI                                                        | Extraire les affirmations qui composent votre profil                                          | **Art. 6(1)(b)**                                                                                                                     |
| Import LinkedIn **par l'API**                                                         | Pré-remplir votre profil                                                                      | **Art. 6(1)(a)** — votre consentement, exprimé chez LinkedIn, retirable à tout moment (section 6.3)                                  |
| Import LinkedIn **par archive**                                                       | Idem                                                                                          | **Art. 6(1)(b)** — vous nous remettez vous-même le document                                                                          |
| Données concernant l'auteur d'une recommandation                                      | Vous permettre d'étayer votre parcours                                                        | **Art. 6(1)(f)** — voir section 7                                                                                                    |
| Interrogation des sept plateformes                                                    | Vous rendre des résultats                                                                     | **Art. 6(1)(b)**                                                                                                                     |
| Tri et classement des offres                                                          | Vous présenter d'abord ce qui vous correspond                                                 | **Art. 6(1)(b)**                                                                                                                     |
| Analyse de trajectoire de carrière                                                    | Situer le niveau au-dessus du vôtre et le chercher aussi                                      | **Art. 6(1)(b)**                                                                                                                     |
| Vocabulaire du métier sur le marché                                                   | Chercher avec les mots que le marché emploie, et non les vôtres                               | **Art. 6(1)(f)** — intérêt légitime : rendre la recherche utilisable. Nous ne rangeons pas ce traitement sous l'exécution du contrat |
| Vérification technique du service, traces et journaux                                 | Détecter les pannes, prévenir les accès non autorisés                                         | **Art. 6(1)(f)** — intérêt légitime : maintien en fonctionnement et sécurité du service                                              |
| Données sensibles présentes de façon incidente dans un CV                             | Voir section 13                                                                               | **Aucune exception de l'art. 9 n'est recueillie aujourd'hui** — voir section 13                                                      |

**Ce sur quoi nous ne nous appuyons pas** : nous n'invoquons l'exécution du contrat ni pour l'amélioration du produit, ni pour des statistiques. Nous n'exerçons aucun de ces traitements. Si nous devions le faire, ce serait sur une base distincte, et vous en seriez informé au préalable (section 22).

---

## 13. Les données sensibles (art. 9 RGPD)

**Nous ne vous demandons aucune donnée** relative à votre santé, votre origine, vos convictions religieuses ou politiques, votre appartenance syndicale, votre vie ou votre orientation sexuelle, ni aucune donnée génétique ou biométrique. Aucun champ du produit ne les appelle.

**Un CV en contient souvent, sans que son auteur y ait pensé** : une interruption de carrière pour raison de santé, un aménagement de poste, un mandat syndical, un engagement confessionnel ou politique, une langue maternelle qui révèle une origine.

**Ce qui se passe alors, exactement.** La mention part chez OpenAI avec le reste du texte : nous ne la retirons pas du CV avant de l'envoyer. Chez nous, aucun champ n'est prévu pour la recevoir. Trois zones de texte libre en accueillent une malgré tout : le résumé que le modèle rédige, vos réponses aux questions du produit, et le texte des preuves que vous ajoutez. Et le résumé fait partie du dossier professionnel : il repart donc chez OpenAI à chaque recherche, pour trier les offres, lire votre trajectoire et chercher le vocabulaire de votre métier.

**La mesure technique que nous appliquons.** Les deux instructions que nous envoyons au modèle — celle qui analyse votre parcours et celle qui en extrait vos compétences — lui interdisent nommément d'extraire **et de reformuler** votre état de santé, un handicap, une grossesse, votre origine raciale ou ethnique, votre nationalité, vos opinions politiques, vos convictions religieuses ou philosophiques, une appartenance syndicale, votre vie ou orientation sexuelle, des données biométriques ou génétiques, et des condamnations pénales. Elles lui interdisent également de donner le motif d'une interruption de carrière.

L'interdiction porte sur la reformulation autant que sur l'extraction, et ce n'est pas un détail : « n'extrais pas » laisserait le modèle libre de conserver une mention en la réécrivant — « disponible après une longue convalescence ».

**Ce que cette mesure ne garantit pas.** Un modèle de langage n'obéit pas comme une règle de filtrage. Nous ne pouvons pas vous promettre qu'aucune mention ne survivra, et nous ne le promettons pas. C'est pourquoi la recommandation ci-dessous reste, à nos yeux, la protection principale — celle qui ne dépend pas de nous.

**Ce que nous vous recommandons** : retirez de votre CV toute mention relative à votre santé, votre origine, vos convictions ou votre appartenance syndicale avant de le déposer. Ici, votre CV n'est pas destiné à un recruteur : il sert à décrire ce que vous savez faire.

**Notre base légale.** Le RGPD interdit par principe le traitement de ces catégories, sauf exception de son article 9 — laquelle s'ajoute à la base légale du traitement et ne la remplace pas. Nous nous fondons sur votre **consentement explicite, art. 9(2)(a)**, recueilli par une case dédiée, jamais pré-cochée, distincte de l'acceptation des conditions générales, et présentée au moment du dépôt de votre CV. Sans elle, nous ne lisons pas votre CV : la demande est refusée côté serveur, et non seulement dans votre navigateur.

La date de votre accord est enregistrée, parce que l'art. 7(1) nous demande de pouvoir le démontrer. Une date déjà enregistrée n'est pas réécrite aux dépôts suivants : elle reste celle du moment où vous avez dit oui.

**Vous pouvez le retirer à tout moment** (art. 7(3)), depuis « Mon compte », sans avoir à vous justifier. Le retrait vaut pour l'avenir : nous ne lirons plus de nouveau CV tant que vous ne l'aurez pas redonné. Ce que le modèle a déjà lu a déjà été lu, et les affirmations qui en sont issues restent dans votre profil, où vous pouvez les rejeter une par une — elles disparaissent avec votre compte.

Nous ne nous fondons **pas** sur l'art. 9(2)(e) (« données manifestement rendues publiques ») : un CV déposé en privé n'est en aucun cas manifestement public.

---

## 14. Combien de temps nous gardons quoi (art. 13(2)(a))

| Élément                                                                                                                                            | Durée                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Fichier PDF de votre CV                                                                                                                            | **Zéro.** Lu en mémoire, jamais écrit                                                                                                           |
| Texte de votre CV                                                                                                                                  | **Zéro chez nous.** Chez OpenAI : durée non établie — voir section 9                                                                            |
| Archive ZIP LinkedIn                                                                                                                               | **Zéro.** Décompressée en mémoire, jamais écrite                                                                                                |
| Jeton d'accès LinkedIn                                                                                                                             | **Zéro.** Ni stocké, ni journalisé                                                                                                              |
| Texte de parcours LinkedIn reconstitué                                                                                                             | **Zéro**                                                                                                                                        |
| Offres consultées                                                                                                                                  | **Zéro en base de données.** En mémoire du serveur : de trente minutes à six heures selon la source (section 4)                                 |
| Dossier professionnel en cache mémoire                                                                                                             | **Une heure au plus**, puis le plan est recalculé                                                                                               |
| Compte, profil, préférences, affirmations et leur historique, preuves, réponses, versions de profil, traces et résultats de vérification technique | **Jusqu'à ce que vous supprimiez votre compte.** Aucune purge automatique n'est programmée : tant que votre compte existe, ces données existent |
| Mot de passe, pour les comptes qui en ont un                                                                                                       | Empreinte détenue par Supabase, jusqu'à la suppression du compte                                                                                |
| Lien de connexion envoyé par e-mail                                                                                                                | **Une heure**                                                                                                                                   |
| Cookie `mp_li_state`                                                                                                                               | **Dix minutes**, et supprimé dès votre retour de LinkedIn, quelle que soit l'issue                                                              |
| Cookies de session                                                                                                                                 | Durée fixée par Supabase Auth, que nous n'avons pas encore relevée                                                                              |
| Journaux serveur                                                                                                                                   | Durée fixée par notre hébergeur, que nous n'avons pas encore relevée                                                                            |

### Supprimer votre compte

**Un bouton de suppression est disponible dans votre profil.** La suppression est **immédiate et définitive**. Nous effaçons votre compte d'authentification, et avec lui, dans la même opération :

- votre profil et vos préférences ;
- vos affirmations et tout leur historique ;
- vos preuves, y compris les recommandations qu'elles contiennent, et leurs liens ;
- vos réponses aux questions ;
- vos versions de profil enregistrées ;
- vos traces et vos résultats de vérification technique.

Nous ne gardons ni corbeille, ni compte désactivé, ni copie de courtoisie. Nous ne pouvons pas restaurer un compte supprimé.

Nous procédons de même, sans délai, si vous demandez la suppression par e-mail à cve@hi-def.be.

**Trois réserves, écrites parce qu'elles sont vraies :**

- les données déjà transmises à OpenAI suivent le cycle propre à cette société, que nous n'avons pas encore établi (section 9) ;
- les journaux serveur déjà écrits, qui ne contiennent pas votre identifiant utilisateur, suivent leur propre cycle chez notre hébergeur ;
- les sauvegardes techniques de la base suivent le cycle de rotation de Supabase, dont nous n'avons pas encore relevé la durée.

---

## 15. Vos droits (art. 13(2)(b) et (c))

Vous disposez, sur les données que nous détenons à votre sujet, des droits suivants.

**Accès** (art. 15) — obtenir la confirmation que vos données sont traitées et en recevoir copie. Le bouton de téléchargement décrit ci-dessous (portabilité) vous en donne une copie immédiate, sans nous écrire.

**Rectification** (art. 16) — corriger ce qui est inexact. Vous le faites depuis votre profil : la correction ajoute une nouvelle affirmation qui remplace la précédente, et la valeur antérieure reste chaînée dans la base. Pour l'effacement de la valeur antérieure elle-même, écrivez-nous.

**Effacement** (art. 17) — supprimer l'intégralité de votre compte depuis « Mon compte ». La suppression est immédiate et définitive : elle efface votre profil, ses versions, vos affirmations et preuves, vos réponses, les offres importées, les analyses écrites pour vous, les traces d'exécution, et votre identité de connexion — e-mail, sessions et journal d'authentification, adresses IP comprises. L'écran vous montre ce qui va disparaître, avec les nombres de l'instant, et ce que nous ne pouvons pas effacer. **Une affirmation ou une preuve prise isolément ne se supprime pas depuis l'interface** : vous pouvez la rejeter, ce qui la retire de votre profil et de la recherche sans effacer la ligne. Pour l'effacement de la donnée elle-même, écrivez à cve@hi-def.be ; nous procédons manuellement dans le mois.

**Limitation** (art. 18) — demander le gel d'un traitement le temps d'une contestation.

**Portabilité** (art. 20) — recevoir vos données dans un format structuré, couramment utilisé et lisible par machine. Un bouton **« Télécharger mes données (JSON) »** est disponible depuis « Mon compte » : le fichier est produit immédiatement et contient les seize familles de données que nos bases détiennent sur vous. Il indique lui-même ce qu'il ne contient pas, et signale toute section qu'il n'aurait pas su lire — une section vide et une section manquante ne se confondent pas.

**Retrait du consentement** (art. 13(2)(c)) — à tout moment, depuis « Mon compte », pour la lecture des informations sensibles d'un CV (section 13) comme pour l'import LinkedIn par l'API (section 6.3). Le retrait vaut pour l'avenir et ne remet pas en cause la licéité de ce qui a été traité avant.

> ### Votre droit d'opposition
>
> **Vous pouvez vous opposer à tout moment, pour des raisons tenant à votre situation particulière, aux traitements que nous fondons sur notre intérêt légitime** (art. 21) : le nom d'affichage dérivé de votre adresse, la recherche du vocabulaire de votre métier, les données concernant l'auteur d'une recommandation, les traces et journaux techniques. Écrivez à cve@hi-def.be. Nous cessons le traitement, sauf motif impérieux que nous vous exposerions.

**Comment les exercer** : écrivez à **cve@hi-def.be**, ou par courrier à Productions Associées ASBL — MissionPilot, Rue Coenraets 72, 1060 Saint-Gilles, Belgique. Nous répondons dans un délai d'un mois à compter de la réception. Si la demande est complexe, nous prolongeons ce délai de deux mois au plus et nous vous en informons dans le premier mois, en vous disant pourquoi (art. 12(3)). Nous ne facturons rien.

---

## 16. Réclamation auprès d'une autorité de contrôle (art. 13(2)(d))

Si vous estimez que le traitement de vos données constitue une violation du RGPD, vous avez le droit d'introduire une réclamation auprès d'une autorité de contrôle, notamment dans l'État membre de votre résidence habituelle, de votre lieu de travail ou du lieu de la violation présumée.

En Belgique, il s'agit de :

> **Autorité de protection des données (APD) / Gegevensbeschermingsautoriteit**
> Rue de la Presse 35 / Drukpersstraat 35, 1000 Bruxelles
> +32 (0)2 274 48 00 — contact@apd-gba.be — dpo@apd-gba.be
> www.autoriteprotectiondonnees.be
> Permanence téléphonique chaque jour ouvrable de 9h00 à 12h00
> Réclamation en ligne, datée et signée : https://moncompte.autoriteprotectiondonnees.be/login

L'APD demande en règle générale que vous ayez d'abord exercé vos droits auprès du responsable du traitement et attendu un mois — sauf dans certains cas clairement motivés, où cette démarche préalable n'est pas nécessaire.

Ce droit s'exerce sans préjudice de tout autre recours administratif ou juridictionnel (art. 78 et 79 RGPD).

---

## 17. Ce que vous devez nous fournir, et ce qui arrive si vous refusez (art. 13(2)(e))

Aucune loi ne vous oblige à nous fournir quoi que ce soit. La fourniture de votre adresse e-mail est une **exigence contractuelle** : sans elle, le contrat ne peut pas être conclu.

| Donnée                                | Nécessaire à quoi                      | Si vous ne la fournissez pas                                                                                                 |
| ------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Adresse e-mail                        | Créer votre compte et vous y connecter | Le compte ne peut pas être créé : c'est votre identifiant, et c'est à cette adresse que part votre lien de connexion         |
| CV, parcours saisi ou import LinkedIn | Établir votre profil                   | Le service n'a rien à partir de quoi chercher. Vous saisissez alors vos affirmations à la main, une par une                  |
| Préférences de recherche              | Filtrer et classer les résultats       | Le service cherche plus large et classe moins bien. **Aucune fonction n'est bloquée**                                        |
| Réponses aux questions du produit     | Préciser votre parcours                | Vous passez chaque question. « Je ne sais pas » et « passer » sont des réponses acceptées. **Aucune fonction n'est bloquée** |
| Import LinkedIn                       | Pré-remplir votre profil               | Rien n'est bloqué. C'est un raccourci, jamais une condition                                                                  |

---

## 18. Tri automatique, classement et profilage (art. 13(2)(f))

Nous décrivons la logique, parce qu'elle vous concerne.

**Ce que fait le service :**

1. Il construit, à partir de votre dossier, un vocabulaire de recherche : jusqu'à six intitulés au niveau que vous occupez, et jusqu'à six au niveau au-dessus quand l'analyse de votre carrière a trouvé de quoi le justifier.
2. Il interroge les sept plateformes de la section 8.
3. Il classe les résultats à partir de vos préférences et de vos compétences confirmées. Quand une source n'a rien dit sur un critère — salaire, lieu, date — nous ne comptons pas ce silence contre l'offre : elle reste dans la liste, sauf si vous demandez explicitement de ne garder que les offres qui l'indiquent.
4. Il répartit les résultats en deux groupes : le niveau que vous occupez, et le niveau au-dessus. **Cette répartition regarde les mots de l'intitulé de l'offre** et les compare aux intitulés du niveau supérieur identifiés par l'analyse de carrière. Aucun seuil de score, aucun modèle n'en décide : vous lisez l'intitulé et vous voyez pourquoi une offre est là.
5. **Un modèle d'OpenAI reçoit votre dossier professionnel et les 25 premières offres — intitulé, entreprise, extrait — et rend un verdict par offre : garder ou écarter. Une offre écartée n'apparaît pas.** Le biais est dissymétrique et volontairement prudent : nous affichons l'offre sauf verdict négatif explicite. Un verdict manquant, un index hors bornes, une réponse tronquée, une panne : nous affichons l'offre. Les offres au-delà de la 25e ne sont pas soumises au modèle.

**Importance et conséquences.** Ce mécanisme modifie l'ordre et la longueur d'une liste que vous consultez. **Il ne décide rien à votre sujet** : il ne vous embauche pas, ne vous refuse pas, ne transmet aucune évaluation de vous à un employeur, n'envoie aucune candidature, et ne vous attribue aucun score enregistré ni transmissible. Sa conséquence est qu'une offre pertinente ne vous est parfois pas présentée.

**Nous en concluons que ce traitement ne constitue pas une décision individuelle automatisée au sens de l'art. 22 RGPD.** Nous le décrivons intégralement quand même, parce qu'il écarte réellement des offres et que vous avez le droit de le savoir. Cette qualification est la nôtre et n'a pas été confirmée par un juriste ; nous préférons vous le dire.

**Vous gardez la main** : vous modifiez vos préférences, vous corrigez ou rejetez toute affirmation, vous lancez vos propres recherches par mots-clés, et vous demandez une explication ou contestez le classement en écrivant à cve@hi-def.be.

**Interaction avec un système d'intelligence artificielle** : MissionPilot lit votre parcours et trie les offres au moyen d'un système d'intelligence artificielle fourni par OpenAI. Vous en êtes informé ici.

---

## 19. Journalisation

Le service écrit des journaux techniques au format JSON sur la sortie standard du serveur.

- Le type du contexte de journalisation n'admet que des valeurs simples : cela écarte, à la compilation, l'écriture d'un objet ou d'une liste entière. **Aucun filtrage n'a lieu à l'exécution.**
- **Votre identifiant utilisateur n'apparaît dans aucun appel de journalisation.** Les journaux portent en revanche des identifiants d'exécution qui se rattachent à votre compte par une jointure en base.
- **Le contenu de votre profil, de votre CV et de vos réponses n'y est jamais écrit.**

**Une limite que nous préférons écrire.** Plusieurs de nos journaux d'erreur enregistrent le texte brut de l'erreur. Quand la base refuse une de vos données — par exemple une réponse trop longue — son message d'erreur reprend parfois cette donnée, et ce message part dans le journal. Nous n'avons constaté aucun cas où cela s'est produit. Rien dans le code ne l'empêche.

---

## 20. Cookies

MissionPilot dépose un cookie de son propre fait. S'y ajoute le cookie de session posé par Supabase Auth, que sa bibliothèque découpe en plusieurs fragments quand le jeton est long.

| Cookie                                    | À quoi il sert                                                                                                                                                                                                            | Durée                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Cookie de session, posé par Supabase Auth | Vous garder connecté d'une page à l'autre                                                                                                                                                                                 | Durée fixée par Supabase Auth, non encore relevée |
| `mp_li_state`                             | Vérifier que c'est bien vous qui revenez de LinkedIn, et empêcher qu'un autre site déclenche cet import à votre place. Il contient un identifiant aléatoire et rien d'autre. Il est inaccessible au JavaScript de la page | 10 minutes, supprimé au retour de LinkedIn        |
| —                                         | **Aucun autre cookie applicatif.** Aucun cookie publicitaire, aucun cookie de mesure d'audience                                                                                                                           | —                                                 |
| Stockage local du navigateur              | Votre choix de thème clair ou sombre. Il reste sur votre appareil et ne nous est jamais transmis                                                                                                                          | Jusqu'à ce que vous l'effaciez                    |

Ces deux cookies sont strictement nécessaires au service que vous demandez : la loi ne nous impose pas de vous demander votre accord avant de les déposer. Il n'y a rien à accepter ni à refuser, et c'est pourquoi vous ne verrez pas de bandeau.

---

## 21. Sécurité

- **Chiffrement en transit** : tous les échanges passent en HTTPS/TLS — avec votre navigateur, avec OpenAI, avec LinkedIn, avec les plateformes d'offres et avec la base de données.
- **Chiffrement au repos** : Supabase déclare chiffrer les données stockées au repos. C'est l'affirmation de notre fournisseur ; elle n'est pas vérifiable depuis notre code, et nous la rapportons comme telle plutôt que de la reprendre à notre compte.
- **Cloisonnement par utilisateur** : les 16 tables du schéma portent une règle de sécurité au niveau de la ligne. Le contrôle est fait par la base, pas par l'application. Cette isolation est couverte par des tests automatisés.
- **Immutabilité choisie** : les versions de profil et les captures d'offres ne sont modifiables par aucun rôle applicatif ; les traces d'exécution sont en ajout seul.
- **Vérification de session** : nous validons votre session côté serveur, sur le jeton signé, et non par simple lecture du cookie — un cookie recopié ne suffit pas à se faire passer pour vous. Nous n'en extrayons que deux choses : votre identifiant et votre adresse e-mail.
- **Contenu externe traité comme des données** : le texte des offres et celui de votre CV sont marqués comme du contenu à lire, jamais comme des consignes à exécuter.
- **Secrets** : les clés d'accès à nos prestataires ne sont jamais transmises au navigateur.

**En cas de violation de données** susceptible d'engendrer un risque pour vos droits, nous notifions l'Autorité de protection des données dans les 72 heures (art. 33) et nous vous informons directement lorsque le risque est élevé (art. 34). Lorsque la violation concerne des données obtenues par l'API LinkedIn, nous en informons également LinkedIn dans les 24 heures, comme les conditions de cette API l'exigent.

---

## 22. Une finalité nouvelle (art. 13(3))

Si nous devions traiter vos données pour une finalité qui ne figure pas ici, nous vous en informerions **avant** de commencer, en vous indiquant cette finalité, sa base juridique, les données concernées, la durée de conservation applicable et vos droits. Si cette finalité repose sur votre consentement, nous vous le demanderions, et un refus n'affecterait pas votre accès au reste du service.

---

## 23. Enfants

MissionPilot s'adresse aux personnes de 18 ans et plus. Nous ne le proposons pas aux mineurs (article 3 des conditions générales d'utilisation).

---

## 24. Modification de cette politique

Nous datons chaque version. Toute modification substantielle vous est annoncée par e-mail à l'adresse de votre compte, au moins quinze jours avant son entrée en vigueur. Les versions antérieures restent lisibles dans l'historique public du code source.

---

## 25. Nous écrire, et vérifier

**cve@hi-def.be** — pour toute question, pour exercer vos droits, et pour obtenir copie des garanties mentionnées en section 11.
Par courrier : Productions Associées ASBL — MissionPilot, Rue Coenraets 72, 1060 Saint-Gilles, Belgique.

Le code de MissionPilot est lisible publiquement : https://github.com/Christophevanengelen/missionpilot. Si vous trouvez un écart entre ce texte et le code, c'est le texte qui a tort : écrivez-nous, ou ouvrez une issue.
