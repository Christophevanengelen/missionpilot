# Notes de livraison

Vérifications faites dans `/Users/jhondoe/Projects/missionpilot` à HEAD `46eb484`, contre `audit-donnees.md` et `dossier-linkedin.md`.

---

## A. À relire le jour de la publication — phrases qui dépendent de l'effacement de compte

L'effacement de compte n'existe pas dans le code à `46eb484` : aucun bouton, aucune action serveur, aucun endpoint, aucune colonne `deleted_at`. Il a été écrit au présent sur instruction. Voici l'inventaire exact.

| Emplacement                                             | Phrase                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Politique, « En un paragraphe »                         | « Vous supprimez votre compte depuis votre profil : la suppression est immédiate et définitive. »                                                                                                                                                                                                   |
| Politique § 1.3                                         | « L'effacement matériel passe par la suppression de votre compte »                                                                                                                                                                                                                                  |
| Politique § 3, ligne _traces de vérification technique_ | « Elles ne partent qu'avec votre compte. »                                                                                                                                                                                                                                                          |
| Politique § 6.3                                         | « ou supprimez votre compte (section 14) »                                                                                                                                                                                                                                                          |
| Politique § 7                                           | portée implicite de la durée renvoyée à la section 14 pour les données de tiers                                                                                                                                                                                                                     |
| Politique § 14, tableau                                 | « **Jusqu'à ce que vous supprimiez votre compte.** » et la ligne « Mot de passe … jusqu'à la suppression du compte »                                                                                                                                                                                |
| Politique § 14, encadré _Supprimer votre compte_        | **Le paragraphe entier**, y compris la liste des six catégories effacées, « Nous ne gardons ni corbeille, ni compte désactivé, ni copie de courtoisie », « Nous ne pouvons pas restaurer un compte supprimé » et « Nous procédons de même, sans délai, si vous demandez la suppression par e-mail » |
| Politique § 15, _Effacement_                            | « supprimer l'intégralité de votre compte depuis votre profil (section 14) »                                                                                                                                                                                                                        |
| CGU § 7                                                 | « Ce droit s'éteint avec la suppression de votre compte. »                                                                                                                                                                                                                                          |
| CGU § 12, _De votre côté_                               | « vous supprimez votre compte à tout moment, depuis votre profil … immédiate et définitive »                                                                                                                                                                                                        |
| CGU § 12, _Si le service s'arrête_                      | « nous supprimons les comptes et leurs données à la date d'arrêt »                                                                                                                                                                                                                                  |

**Condition technique dont dépend l'exactitude de la cascade — à vérifier par un test réel, pas par raisonnement.** Les trois tables racines (`candidate_profiles`, `agent_runs`, `system_health_results`) référencent `auth.users(id) on delete cascade`, et tout le reste cascade depuis `candidate_profiles`. **La suppression doit donc porter sur la ligne `auth.users` (appel `auth.admin.deleteUser` ou équivalent `service_role`).** Une suppression table par table laisserait `agent_runs` et `agent_steps` en place : aucun `delete` n'y est accordé, **même à `service_role`** (`20260722163150:118-120`, `:160-163`). La cascade au niveau du moteur passe outre cette absence de `grant` ; un effacement applicatif, non.

**Deux phrases dépendantes d'autre chose que l'effacement de compte, à traiter séparément :**

- Politique § 15, _Portabilité_ et _Effacement_ — « nous procédons manuellement dans le mois », « ce droit s'exerce par e-mail ». Ce sont des engagements opérationnels : aucun export ni workflow d'effacement n'existe dans le code. Tenables à la main tant que la volumétrie est faible.
- CGU § 12 — « quinze jours pour demander une copie de vos données ». Même dépendance.

---

## B. Questions ouvertes — une ligne de réponse suffit

**Bloquantes : ne pas publier sans la réponse.**

1. **Case de consentement art. 9** — livrez-vous, avant publication, une case dédiée et non pré-cochée à l'écran de dépôt du CV ? _Oui / Non._ Si oui, la section 13 est réécrite sur l'art. 9(2)(a), avec droit de retrait et suppression des affirmations extraites ; si non, elle reste telle qu'écrite (aveu du manque).
2. **Entité OpenAI contractante** — quel nom exact figure sur votre contrat : OpenAI, L.L.C. / OpenAI Ireland Ltd / autre ?
3. **DPA OpenAI** — est-il signé, et incorpore-t-il les clauses contractuelles types (décision 2021/914) ? _Oui / Non._ Sans « oui », la phrase de la § 11.1 ne se publie pas.
4. **Rétention OpenAI** — rétention zéro activée, ou rétention par défaut ? Quelle durée ?
5. **Résidence des données UE chez OpenAI** — activée ? _Oui / Non._
6. **Provider de production** — le déploiement tourne-t-il avec `AI_DEFAULT_PROVIDER=openai` et une clé ? _Oui / Non._
7. **Région Supabase** — laquelle (`eu-central-1`, `eu-west-*`, autre) ? Entité contractante sur le DPA : Supabase Inc. (US) ou entité européenne ? Un accès distant du support depuis les États-Unis est-il prévu ?
8. **Région Vercel** — région d'exécution des fonctions ? DPA signé ? Rétention des journaux sur votre offre ?
9. **Inngest** — entité contractante et région ? (Un identifiant d'utilisateur y transite : c'est une donnée personnelle.)
10. **Sauvegardes Supabase** — combien de temps une sauvegarde survit-elle à une suppression de compte ? (Détermine la véracité de « ni copie de courtoisie ».)
11. **Durées Supabase Auth en production** — expiration de session, du jeton de rafraîchissement, et du lien de connexion (le `config.toml` du dépôt est la configuration locale, il ne prouve rien sur la production) ?
12. **Licence du code** — MIT, Apache-2.0, AGPL-3.0, autre ? Le fichier `LICENSE` doit être dans le dépôt avant que le projet soit décrit comme open source où que ce soit.
13. **DPO** — Productions Associées a-t-elle désigné un délégué à la protection des données ? _Oui + coordonnées / Non._

**Importantes : le document se publie, un écart subsiste.**

14. **Sources réellement actives en production** — lesquelles des sept variables sont renseignées (`ADZUNA_APP_ID`/`_KEY`, `FRANCE_TRAVAIL_CLIENT_ID`/`_SECRET`, `REMOTIVE_ENABLED`, `HIMALAYAS_ENABLED`, `JOBICY_ENABLED`, `REMOTEOK_ENABLED`, `RECRUITEE_ENABLED`) ? Les sept sont conditionnelles ; je retire les inactives de la § 8 et des CGU sur votre réponse.
15. **Compte dormant** — acceptez-vous une durée d'inactivité au terme de laquelle le compte est supprimé (24 mois, avertissement 30 jours avant) ? _Oui / Non._ En l'état, la politique documente une conservation sans terme, ce que l'art. 5(1)(e) soutient mal.
16. **Suisse** — la § 6.3 dit « Espace économique européen » ; `src/lib/copy/index.ts:279` et `:1172` disent « UE et Suisse ». Lequel des deux corrige-t-on ? La documentation LinkedIn se contredit sur ce point pour le produit 3rd Party.
17. **Art. 22 et AI Act** — à faire trancher par un juriste belge : le retrait automatique d'offres (§ 18, point 5) déclenche-t-il l'art. 22 ? Le service relève-t-il du membre « publier des offres d'emploi ciblées » de l'annexe III(4) de l'AI Act ?
18. **Base légale du compte obligatoire** — 6(1)(b) tient-il au regard des Recommandations EDPB 2/2025 ? (question 23 du dossier)
19. **Volumétrie visée** — commande la question du DPO (art. 37(1)(c)) et de l'AIPD (art. 35).
20. **Produit LinkedIn** — si le service ne sert que vous, sur vos propres données, le produit _Member Data Portability (Member)_ supprime formulaire, entité légale, e-mail professionnel et revue humaine. Question non tranchée, et elle conditionne l'utilité du travail de conformité au formulaire 3rd Party.
21. **Domaine de publication** — la politique doit être publique, sans authentification, sur le domaine déclaré au formulaire LinkedIn. `hi-def.be` renvoyait HTTP 503 au dernier constat. `hi-def.be` réactivé, ou `missionpilot.vercel.app` déclaré ?

**Documents internes à établir, hors des deux textes** : registre des traitements (art. 30 — obligatoire dès que des données de l'art. 9 sont traitées), mise en balance écrite pour chacun des quatre traitements fondés sur l'art. 6(1)(f), liste des personnes ayant accès aux données avec description de leur fonction (obligation belge liée à l'art. 9), analyse d'impact du transfert vers OpenAI, AIPD selon la volumétrie.

---

## C. Trois corrections apportées à `audit-donnees.md`

L'audit fait autorité, mais il n'est pas infaillible. Trois points ont été relus dans le code et corrigés **dans le sens qui déclare plus de traitement, jamais moins** :

1. **Six domaines LinkedIn, pas cinq.** L'audit § 5 s'arrête à `linkedin-mdp-normalise.ts:31-36`. La ligne 37 déclare `jobSeekerPreferences: "JOB_SEEKER_PREFERENCES"`, et `linkedin-mdp.ts:143` boucle sur la totalité de l'objet, sans filtre. Le contenu est exploité en clair (`linkedin-export.ts:249-264` : postes visés, lieux, secteurs, types de poste, taille d'entreprise). L'audit liste d'ailleurs `job seeker preferences.csv` côté archive. **À revérifier le jour de la publication contre cet objet : toute entrée ajoutée rend la § 6.1 fausse sans qu'aucun test ne le signale.**
2. **Les mots-clés envoyés aux plateformes.** L'audit § 3 écrit « max 5 ». Le 5 est le plafond _par requête_ (`adzuna.ts:169`, `france-travail.ts`). Le nombre d'intitulés distincts va jusqu'à douze (`ai-vocabulary.ts:41` `MAX_TERMS = 6`, demandé deux fois dans `plan-from-profile.ts:110-133`), chacun étant une requête séparée. Le repli envoie jusqu'à trois métiers cibles, ou l'intitulé de rôle confirmé et les compétences confirmées (`discovery/plan.ts:19-53`). Et les codes pays issus de `allowedWorkRegions` partent vers Adzuna (segment d'URL) et Himalayas (paramètre `country`).
3. **Les offres résident en mémoire du serveur.** L'audit § 9 signale le cache du plan (une heure) et pas les quatre caches de résultats : Himalayas 6 h (`himalayas.ts:83`), Jobicy 1 h, Remote OK 1 h, Recruitee 30 min. « Aucune écriture en base » reste exact ; « rien ne subsiste » ne l'aurait pas été.

Deux autres points, hors audit, vérifiés et intégrés : les recommandations reçues de LinkedIn partent chez OpenAI, attribuées (`linkedin-export.ts:216-243`) ; l'analyse du CV rend **sept** champs, pas six (`cv-ai.ts:29-52`), dont `roleRationale`, deuxième zone de texte libre après `summary`.

---

## D. Ce que la politique ne dit pas volontairement, et pourquoi

**Elle ne dit pas « votre CV ne quitte pas nos serveurs ».** C'est faux : son texte part entier chez OpenAI. Formulation interdite par l'audit § 10, et la phrase inverse est en tête du document.

**Elle ne dit pas « vos données sont anonymisées avant analyse ».** Aucune anonymisation, aucun caviardage n'existe dans le code.

**Elle ne dit pas « l'application ne peut pas conserver les offres ».** Le code de persistance existe (RPC `import_opportunity`, Server Actions orphelines) ; il n'est atteignable depuis aucun écran. Nous écrivons « nous ne les écrivons dans aucune table », et la § 3 nomme les sept tables vides plutôt que de laisser croire qu'elles n'existent pas.

**Elle ne dit pas que le modèle reçoit l'instruction de ne pas extraire les données sensibles.** Les deux seules instructions envoyées (`cv-ai.ts:88` et `:118`) ne contiennent rien de tel, et `prompts/` ne contient aucun prompt de production. C'est la mesure technique que le dossier § 4.D recommandait d'écrire ; elle n'existe pas, donc elle n'est pas écrite. La § 13 dit l'inverse en toutes lettres.

**Elle ne dit pas que les données sensibles sont exclues des critères de tri.** Le résumé produit par le modèle entre dans le dossier professionnel (`insight-logic.ts:73`), et ce dossier est l'entrée du tri qui écarte des offres (`ai-triage.ts:129`). Une mention restée dans le résumé participe donc au tri. La § 13 le dit.

**Elle n'invoque pas l'art. 9(2)(a).** La case de consentement n'existe pas. Déclarer une base légale adossée à un mécanisme inexistant serait un mensonge doublé de sa propre preuve écrite.

**Elle n'invoque pas l'exemption 14(5)(b)** pour les auteurs de recommandations : la mise en balance qu'elle exige n'est pas documentée. La § 7 décrit le traitement, le limite, ouvre un canal de contact et donne les mentions de l'art. 14 — c'est l'information rendue publiquement disponible, dite comme telle.

**Elle ne promet pas de bouton d'export ni de suppression unitaire.** Aucun `delete` n'est accordé à `authenticated` sur `profile_claims`, `evidence_items`, `claim_evidence_links` ni `profile_versions` ; le mot « supprimer » n'existe pas dans les libellés du produit ; ce que l'interface appelle « rejeter » change un état et laisse la ligne. Les § 1.3 et 15 disent exactement cela. C'est le défaut que trois critiques ont jugé le plus grave dans les versions précédentes.

**Elle ne dit pas que l'e-mail est « le seul moyen d'authentification ».** La connexion par mot de passe existe et est atteignable depuis l'écran de connexion (`login-form.tsx:132`, `auth/actions.ts:94`). Le § 3 et le § 14 mentionnent l'empreinte détenue par Supabase.

**Elle ne s'engage à rien sur ce que la personne verra à l'écran de dépôt.** Le texte actuel (`copy/index.ts:224`) dit « Le fichier n'est jamais conservé » et ne nomme ni OpenAI ni les États-Unis — il produit exactement la croyance que ce document dément. **Corriger cet écran avant la publication** ; c'est le moment décisif au sens du WP260, et c'est la seule correction de cette liste qui touche au produit plutôt qu'au texte. La politique ne promet pas de notice à cet endroit, précisément parce qu'elle n'existe pas encore.

**Elle ne nomme pas Vercel « sur la foi du code ».** L'audit § 10 l'interdit, et le dépôt ne contient ni `vercel.json` ni Dockerfile. Le § 10 le nomme sur la foi de l'adresse de déploiement, et le dit.

**Elle ne reprend aucune citation d'autorité réfutée.** Les formules attribuées au guide CNIL du 30 janvier 2023 et démenties par le dossier § 4.D n'apparaissent pas, même paraphrasées avec guillemets.

**Elle n'emploie ni « peut », ni « pourrait », ni « éventuellement » pour décrire un traitement.** Ces mots ne servent qu'à décrire ce que **vous** pouvez faire. Là où l'incertitude est réelle, elle est nommée : « Nous n'avons constaté aucun cas. Rien dans le code ne l'empêche. »
