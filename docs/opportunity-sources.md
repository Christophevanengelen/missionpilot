# Registre des sources d'opportunités

**Le fichier vivant de la veille.** Toute plateforme qui diffuse des offres —
emploi, mission, freelance — est recensée ici avec son mode d'accès réel, ses
conditions d'utilisation, et la date à laquelle nous l'avons vérifiée nous-mêmes.

Il ne s'agit pas d'une liste de liens. C'est la **mémoire institutionnelle de la
couverture** : ce qui est intégrable, ce qui ne l'est pas et pourquoi, ce qui est
mort depuis, ce qui est réapparu. La force du moteur vient du nombre et de la
qualité des plateformes qu'il atteint ; ce registre est donc l'actif principal du
projet, avant le code.

## Comment ce fichier se maintient

Une source ne reste pas dans ce registre parce qu'elle y a été mise un jour. Elle
y reste parce qu'on la revérifie.

| Règle                                                                   | Pourquoi                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Chaque ligne porte une **date de vérification** et le **moyen** utilisé | Une API vivante en juillet peut être morte en octobre. Sans date, une ligne est une rumeur.                                            |
| On ne consigne que ce qu'on a **appelé soi-même**                       | Un article de blog qui dit « X a une API » n'est pas une vérification. Le champ statut dit `NON VÉRIFIÉ` quand c'est le cas.           |
| Un domaine qui **bloque** (403, mur de login) est consigné comme tel    | C'est une information, pas un échec. Et on ne contourne jamais.                                                                        |
| Les **CGU** sont citées, pas résumées de mémoire                        | La différence entre « interdit le scraping » et « interdit la constitution d'une base concurrente » décide de la viabilité du produit. |
| Une source **retirée** reste dans le fichier, barrée, avec la raison    | Sinon on la re-découvre et on refait le travail.                                                                                       |

**Statuts** — `INTÉGRÉE` · `INTÉGRABLE` (vérifiée, pas encore branchée) ·
`À DEMANDER` (partenariat/autorisation) · `NON VÉRIFIÉ` (bloquée ou inaccessible)
· `EXCLUE` (CGU incompatibles) · `MORTE`

---

## Intégrées aujourd'hui

| Source             | Accès                                      | Clé ?   | Vérifié    | Contrainte                                                                                                                                      |
| ------------------ | ------------------------------------------ | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adzuna**         | API officielle, index partitionné par pays | oui     | 2026-07-25 | Palier gratuit **non commercial** ; badge « Jobs by Adzuna » 116×23 px obligatoire ; champ `salary_is_predicted` à rejeter (estimation machine) |
| **France Travail** | OAuth2 « Offres d'emploi v2 »              | oui     | 2026-07-25 | **En panne** : `invalid_client`. Identifiants à régénérer côté propriétaire                                                                     |
| **Himalayas**      | `himalayas.app/jobs/api/search`            | **non** | 2026-07-25 | Lien retour visible obligatoire ; pas de resoumission vers des job boards tiers ; données rafraîchies 24 h                                      |
| **Jobicy**         | `jobicy.com/api/v2/remote-jobs`            | **non** | 2026-07-25 | Crédit avec lien DIRECT ; boutons de candidature vers l'URL d'origine ; ≤ 1 requête/heure                                                       |
| **Remotive**       | `remotive.com/api/remote-jobs`             | **non** | 2026-07-25 | Attribution + lien retour ; pas de republication vers des tiers                                                                                 |

## Vérifiées, pas encore branchées

| Source                      | Accès                               | Clé ?            | Vérifié    | Note                                                                                                                                                         |
| --------------------------- | ----------------------------------- | ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PeoplePerHour**           | RSS `/feed/jobs`                    | non              | 2026-07-25 | **La seule source auditée portant de vraies missions freelance.** CGU sans clause anti-automatisation. Schéma pauvre : titre/description/lien/date seulement |
| **Silkhom**                 | RSS `/nos-offres-demploi/feed/`     | non              | 2026-07-25 | ~50 offres vivantes. Cabinet FR. Mentions légales restreignent l'extraction de base → demander confirmation écrite                                           |
| **Careerjet**               | `search.api.careerjet.net/v4/query` | oui (gratuite)   | 2026-07-25 | Couvre FR **et** BE. Plafond ~1000 résultats/requête. Liste des locales non publiée                                                                          |
| **Arbeitnow**               | `arbeitnow.com/api/job-board-api`   | non              | 2026-07-25 | Lien retour obligatoire. Fort biais DACH, pas de salaire structuré                                                                                           |
| **Le Forem** (Wallonie)     | Open data ODWB                      | non              | 2026-07-25 | 26 003 offres, MAJ quotidienne — mais **110 indépendants, zéro en tech/design**. Licence CC BY-SA 4.0 (share-alike à trancher)                               |
| **The Muse**                | `themuse.com/api/public/jobs`       | optionnelle      | 2026-07-25 | Très US. Ni salaire, ni type de contrat, ni télétravail structurés. Backlink obligatoire                                                                     |
| **Reed.co.uk**              | `reed.co.uk/api`                    | oui              | 2026-07-25 | UK uniquement. Page CGU en 404                                                                                                                               |
| **Jooble**                  | `POST jooble.org/api/{key}`         | oui (formulaire) | 2026-07-25 | Volume FR/BE élevé, qualité de données faible (salaire en texte libre)                                                                                       |
| **JSearch** (OpenWeb Ninja) | `api.openwebninja.com/jsearch`      | oui              | 2026-07-25 | Champs riches. **200 req/mois** en gratuit → inutilisable en prod sans payer                                                                                 |

## Pages carrières d'entreprises (ATS) — le gisement

Les logiciels de recrutement exposent les offres de leurs entreprises clientes en
JSON public documenté, **sans authentification**. C'est du « crawl du monde
entier » par la porte d'entrée.

| Éditeur        | Point d'accès                                                  | Champs                                                                                    | Vérifié    |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| **Ashby**      | `api.ashbyhq.com/posting-api/job-board/{nom}`                  | Le plus riche : `isRemote`, `employmentType` (dont **Contract**), rémunération structurée | 2026-07-25 |
| **Lever**      | `api.lever.co/v0/postings/{site}` (+ `api.eu.lever.co`)        | `workplaceType`, `salaryRange`                                                            | 2026-07-25 |
| **Greenhouse** | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Complet, mais salaire = 1 appel par offre                                                 | 2026-07-25 |
| **Workable**   | `www.workable.com/api/accounts/{sous-domaine}`                 | Le plus pauvre, documentation partielle                                                   | 2026-07-25 |

**Volumes de locataires mesurés** (passe du 2026-07-26, énumération par l'index
Common Crawl et une liste communautaire sous licence MIT — jamais par scraping) :

| Éditeur        | Slugs connus | Taux de réponse mesuré | Note                                                                              |
| -------------- | ------------ | ---------------------- | --------------------------------------------------------------------------------- |
| **Workday**    | 12 884       | non mesuré             | Le plus gros parc, schéma non audité                                              |
| **BambooHR**   | 11 316       | non mesuré             | —                                                                                 |
| **iCIMS**      | 10 108       | non mesuré             | —                                                                                 |
| **Greenhouse** | 8 333        | **~65 %**              | Un seul locataire testé rendait 536 offres                                        |
| **Lever**      | 4 368        | **~68 %**              | **Absent de Common Crawl** (`CCBot` bloqué) → amorçage par la liste communautaire |
| **Ashby**      | 3 161        | **~95 %**              | Le meilleur taux de survie du registre                                            |

⚠️ **Piège vérifié :** chez Ashby, n'utiliser **que** `posting-api`.
`jobs.ashbyhq.com/api/non-user-graphql` est **interdit par leur `robots.txt`**.
Chez Lever, `api.lever.co/robots.txt` vaut `Allow: /` et `jobs.lever.co` publie
`Content-Signal: search=yes` — une autorisation d'indexation lisible par machine,
assortie d'un `ai-train=no` que nous respectons (nous n'entraînons rien).

**Le verrou, et il n'est pas juridique :** aucun éditeur ne publie l'annuaire de
ses entreprises clientes. Sans les jetons, le gisement est inatteignable. Trois
voies compatibles avec notre règle (aucune n'est du scraping) :

1. **L'index d'URL Common Crawl** filtré sur les quatre domaines — c'est un jeu
   de données _publié_, le consulter n'est pas aspirer un site.
2. Des **listes communautaires** sous licence permissive (une revendique ~63 000
   locataires ATS — _non vérifié_).
3. Une **liste d'entreprises cibles** constituée à la main : le jeton se lit dans
   l'URL de leur page carrières.

⚠️ **Non audité** : les CGU des quatre éditeurs. « Point d'accès public documenté »
n'est pas « licencié pour réusage commercial ». À vérifier avant production.

## À demander (partenariat ou autorisation)

| Source                                  | Pourquoi cette voie                                                                                                   | Contact                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Freelance.com** (a absorbé Coworkees) | Conditions **sans clause anti-extraction**, groupe coté, fonction commerciale formelle                                | `plateforme.freelance.com/contactez-nous` |
| **Freelancermap**                       | Meilleure adéquation marché (freelance IT DACH/UE) et `robots.txt` totalement permissif — mais API entrante seulement | `support@freelancermap.com`               |
| **Freelance.de**                        | `robots.txt` désigne explicitement une voie d'autorisation écrite                                                     | `support@freelance.de`                    |
| **Cadres en Mission**                   | Sollicite activement des dépôts de missions                                                                           | formulaire entreprise                     |
| **Silkhom**                             | Confirmer que la consommation du flux RSS est permise                                                                 | —                                         |

## Exclues — CGU incompatibles

Ces plateformes interdisent explicitement ce que ce produit ferait. **La règle est
définitive**, y compris sous pression.

| Source                                  | Clause                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LinkedIn**, **Indeed**, **Glassdoor** | Interdiction de scraping ; risque de bannissement et contractuel                                                                                            |
| **Contra**                              | CGU du 09/04/2026, §14(b)(5) : robots, crawlers et outils de data mining nommés. _Piège : leur `robots.txt` est quasi ouvert — il ne vaut pas consentement_ |
| **StaffMe**                             | Art. 8.1.13 / 10 / XI.4 : extraction automatisée interdite, **2 000 € par manquement**                                                                      |
| **Kicklox**                             | CGVU Art. 14.2.3 : interdit les robots **et la constitution d'une base concurrente** — la description exacte de ce produit                                  |
| **Toptal**                              | CGU « Ownership and Restrictions » : _page-scraper_, _spider_, _robot_                                                                                      |
| **We Work Remotely**                    | Interdit de stocker leurs données et de bâtir un produit concurrent                                                                                         |
| **Brigad**                              | Art. 7.1 + Annexe 1 §4 (et mauvais secteur : hôtellerie/santé)                                                                                              |

## Mortes ou inaccessibles

| Source                                                                  | État                                                                                               | Vérifié    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| **Indeed Publisher API**                                                | **FERMÉE** — 301 vers `partners.indeed.com`, plus d'API de recherche                               | 2026-07-25 |
| **Talent.com**                                                          | Mur de login, aucun schéma publié                                                                  | 2026-07-25 |
| **Bundesagentur für Arbeit**                                            | Aucune API officielle ; seuls des dépôts rétro-ingéniérés                                          | 2026-07-25 |
| **EURES**                                                               | Endpoint interne sans documentation officielle → scraping déguisé. L'API officielle est _entrante_ | 2026-07-25 |
| **Actiris**                                                             | Aucune API d'offres (le portail ne publie que des statistiques)                                    | 2026-07-25 |
| **VDAB**                                                                | API verrouillée derrière un partenariat payant                                                     | 2026-07-25 |
| **RemoteOK**                                                            | 403 sur requête serveur                                                                            | 2026-07-25 |
| **WhatJobs**, **Findwork.dev**, **Truelancer**, **Workana**, **Fiverr** | 403 ou mur de login                                                                                | 2026-07-25 |
| **LesJeudis**, **ChooseYourBoss**                                       | Bloquent toute requête automatisée                                                                 | 2026-07-25 |
| **Prium Portage**                                                       | Fusionné dans OpenWork                                                                             | 2026-07-25 |
| **Ventoris**                                                            | Domaine ne résout plus ; redressement judiciaire depuis 2023                                       | 2026-07-25 |
| **Coworkees**                                                           | Redirige vers Freelance.com — voir « À demander »                                                  | 2026-07-25 |
| **Malt**                                                                | Aucune API publique ; intégrations SI d'entreprise uniquement                                      | 2026-07-25 |
| **Portage salarial** (ITG, AD'Missions, OpenWork, Régie Portage)        | Ces sociétés n'ont pas de bourse aux missions — ce sont des gestionnaires de paie                  | 2026-07-25 |

---

## Les trous de couverture — sans complaisance

Un registre qui ne liste que ses réussites ment par omission. Ce que le moteur
**ne** couvre **pas**, mesuré à la passe du 2026-07-26 :

| Zone                                            | État                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Europe de l'Ouest et du Sud** (DE, ES, IT, NL, AT, PT) | ⚠️ **Absence de recherche, pas absence de sources.** Aucune passe de veille n'a reçu ce périmètre. C'est la plus grosse lacune et la plus facile à combler. |
| **Moyen-Orient / Golfe**                        | Zéro. Bayt, GulfTalent, Naukrigulf : aucune API de lecture. Adzuna ne couvre aucun pays du Golfe.                                                     |
| **Asie du Sud-Est + Hong Kong**                 | Zéro. Verrouillage par le duopole SEEK / JobStreet-JobsDB.                                                                                            |
| **Inde**                                        | Zéro. Naukri exclue, NCS en 403. Deuxième bassin de talents mondial, non couvert.                                                                     |
| **Amérique latine hispanophone**                | Zéro. Computrabajo, le portail dominant, est fermé.                                                                                                  |
| **Afrique**                                     | Quasi zéro. Seule ouverture `za` chez Adzuna, plombée par sa clause d'agrégation. ReliefWeb est la seule piste réaliste.                              |
| **Australie / Nouvelle-Zélande**                | Aucune source sans clé. Adzuna, licence à négocier, est la seule voie.                                                                                |
| **Japon**                                       | Une seule piste (API e-Gov Hello Work), en 403.                                                                                                      |
| **Danemark, Baltes, Roumanie, Islande**         | Aucune source identifiée. Pour le Danemark la recherche a été menée sans résultat ; pour les autres elle n'a pas été menée.                           |
| **Vietnam, Taïwan, Corée du Sud**               | Non explorés. Angle mort assumé.                                                                                                                     |

**Trous par segment, indépendants de la géographie :**

- **Freelance / mission senior — le trou le plus grave du produit.** Aucune place
  de marché de missions pour profils expérimentés n'a d'API ouverte confirmée, sur
  aucune zone. Le signal « contrat » exploitable ne vient donc pas d'une place de
  marché : il vient de `employmentType` chez Ashby et Himalayas, et de `jobType`
  chez Jobicy. Partout ailleurs, il faudra une classification côté moteur.
- **Salaire structuré : minoritaire.** Absent chez Greenhouse, Lever, Working
  Nomads, WWR — c'est-à-dire précisément les sources de plus gros volume.
- **Télétravail structuré : rarissime.** Seul Ashby le type réellement
  (`isRemote` + `workplaceType`).

⚠️ **Le piège à ne pas se tendre à soi-même :** Jobicy, Himalayas, Working Nomads
et Remote OK sont des sources « travailler **à distance depuis** une région », pas
« emplois **dans** cette région ». Elles ne comptent jamais comme couverture de
l'Afrique, du MENA ou de l'Amérique latine — le biais US mesuré chez Himalayas le
confirme.

---

## À explorer — la veille continue

Ce qui n'a pas encore été vérifié, par ordre d'intérêt. **Chaque passe de veille
doit vider un peu cette liste et revérifier les lignes les plus anciennes.**

- **Guru.com** — une page de doc d'API répond (HTTP 200) mais son corps est rendu
  en JavaScript et reste illisible. Dix minutes dans un vrai navigateur
  trancheraient la seule question réellement ouverte de l'audit.
- Marchés nordiques, ibériques, italiens : services publics de l'emploi.
- Agrégateurs de niche par métier (design, produit, data) publiant un flux.
- Boards d'écosystème (YC, a16z, communautés) exposant un JSON public.
- Flux RSS de cabinets de recrutement spécialisés, sur le modèle de Silkhom.
- Sitemaps `schema.org/JobPosting` — publier un sitemap machine est une invitation
  à le lire.

---

_Dernière passe de veille complète : **2026-07-25**. Toute ligne dont la date de
vérification dépasse trois mois doit être considérée comme périmée jusqu'à
nouvelle vérification._
