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

## Crédits de source — ce qui est fait, ce qui ne l'est pas

Plusieurs sources font d'une mention nommée et d'un lien retour une **condition
d'usage**, et une attribution par carte ne satisfait pas une clause qui exige un
crédit visible sur l'ENSEMBLE des résultats.

Depuis le 2026-07-26, un bloc de crédits est rendu sous les résultats, calculé
**à partir des offres réellement affichées** — jamais à partir des sources
configurées : créditer une source qui n'a rien renvoyé serait mentir sur la
provenance de ce qui est à l'écran.

| Source        | Clause                                                   | État                                  |
| ------------- | -------------------------------------------------------- | ------------------------------------- |
| **Adzuna**    | « Jobs by Adzuna », « Jobs » hyperlié vers adzuna.co.uk  | ⚠️ **Partiel** — voir ci-dessous      |
| **Remote OK** | Lien **dofollow** + mention « Remote OK », logo interdit | Fait (mention + lien, aucun logo)     |
| **Jobicy**    | Crédit + lien direct vers l'annonce d'origine            | Fait (crédit global + lien par offre) |
| **Himalayas** | Lien retour visible                                      | Fait                                  |
| **Remotive**  | Attribution + lien retour                                | Fait                                  |

⚠️ **Deux points Adzuna restent ouverts, et ils appartiennent au propriétaire :**

1. Leur clause spécifie un **badge IMAGE d'au moins 116×23 px**. Ce qui est
   rendu aujourd'hui est la formulation et le lien exigés — strictement mieux
   que le néant précédent, mais ce n'est pas le badge image.
2. Le **palier gratuit est non commercial**, et leur clause interdit l'usage
   « in aggregation … to deliver any ongoing work or research » au-delà de
   14 jours sans accord écrit. Un méta-moteur tombe littéralement dedans.

Tant que ces deux points ne sont pas tranchés, Adzuna ne devrait pas être mis en
avant comme source de production.

## Les trous de couverture — sans complaisance

Un registre qui ne liste que ses réussites ment par omission. Ce que le moteur
**ne** couvre **pas**, mesuré à la passe du 2026-07-26 :

| Zone                                                     | État                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Europe de l'Ouest et du Sud** (DE, ES, IT, NL, AT, PT) | Passe menée le 2026-07-26 — voir la section dédiée plus bas. Résultat sobre : **DE-AT-CH et NL-BE-LU ressortent avec zéro source intégrable**, et aucune source retenue ne porte de salaire ni de télétravail structurés. |
| **Moyen-Orient / Golfe**                                 | Zéro. Bayt, GulfTalent, Naukrigulf : aucune API de lecture. Adzuna ne couvre aucun pays du Golfe.                                                                                                                         |
| **Asie du Sud-Est + Hong Kong**                          | Zéro. Verrouillage par le duopole SEEK / JobStreet-JobsDB.                                                                                                                                                                |
| **Inde**                                                 | Zéro. Naukri exclue, NCS en 403. Deuxième bassin de talents mondial, non couvert.                                                                                                                                         |
| **Amérique latine hispanophone**                         | Zéro. Computrabajo, le portail dominant, est fermé.                                                                                                                                                                       |
| **Afrique**                                              | Quasi zéro. Seule ouverture `za` chez Adzuna, plombée par sa clause d'agrégation. ReliefWeb est la seule piste réaliste.                                                                                                  |
| **Australie / Nouvelle-Zélande**                         | Aucune source sans clé. Adzuna, licence à négocier, est la seule voie.                                                                                                                                                    |
| **Japon**                                                | Une seule piste (API e-Gov Hello Work), en 403.                                                                                                                                                                           |
| **Danemark, Baltes, Roumanie, Islande**                  | Aucune source identifiée. Pour le Danemark la recherche a été menée sans résultat ; pour les autres elle n'a pas été menée.                                                                                               |
| **Vietnam, Taïwan, Corée du Sud**                        | Non explorés. Angle mort assumé.                                                                                                                                                                                          |

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

# Europe de l'Ouest et du Sud

**Passe du 2026-07-26.** Le registre notait cette zone comme « absence de
recherche, pas absence de sources ». Elle a été menée : 8 rapporteurs, 60
sources examinées, chacune appelée réellement, puis attaquée par un vérificateur
adverse dont la consigne était de RÉFUTER.

⚠️ **Limite de cette passe, à connaître avant de s'y fier.** Douze des vingt-neuf
agents sont morts en surcharge du fournisseur, dont la quasi-totalité des
vérificateurs adverses de la zone FR et une partie de ES-PT. Les lignes
concernées reposent donc sur **une seule lecture**, pas sur deux. La zone
NORDIQUES-MANQUANTS n'a jamais abouti. Ce n'est pas une raison de jeter le
résultat, c'en est une de ne pas le traiter comme contre-vérifié : toute ligne
FR doit être re-testée avant d'être branchée.

## Europe de l'Ouest et du Sud — passe du 2026-07-26

Sources retenues : `INTEGRABLE` (appelable en l'état, sous réserve de la contrainte citée) et `A_DEMANDER` (accord écrit à obtenir avant toute intégration).

| Source                                                     | Zone                      | Accès                                                                                                                   | Clé ?                  | Vérifié                                                                                                  | Contrainte                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groupe BPCE — offres d'emploi (portail ODS)                | FR                        | `GET bpce.opendatasoft.com/api/explore/v2.1/catalog/datasets/groupe-bpce-offres-emploi/records`                         | non                    | 2026-07-26 — HTTP 200, `total_count` 2 092, rafraîchi 4x/jour                                            | Licence Ouverte 2.0 : « mentionner la paternité de l'"Information" : sa source (au moins le nom du "Concédant") et la date de dernière mise à jour ». Afficher « Groupe BPCE » + date ; le lien sortant vaut acquittement. Écarter au parsing `nom_recruteur_principal` et `email_recruteur_principal` (données personnelles). Mono-employeur.                                                             |
| Choisir le Service Public — via API tabulaire data.gouv.fr | FR                        | `GET tabular-api.data.gouv.fr/api/resources/{uuid}/data/` (uuid résolu via `/api/1/datasets/6322e99e12175f7eb26ff465/`) | non                    | 2026-07-26 — HTTP 200, pagination serveur, dataset `weekly`, last_update 2026-07-20                      | lov2, même clause de paternité ; la licence autorise expressément « de l'exploiter à titre commercial... ou en l'incluant dans son propre produit ou application ». Requête côté serveur = compatible zéro-stockage. Aucun lien retour par offre. UUID de ressource à re-résoudre à chaque publication hebdo. API estampillée bêta.                                                                        |
| Ville de Tours (ODS Tours Métropole)                       | FR                        | `GET data.tours-metropole.fr/api/explore/v2.1/catalog/datasets/offres-emploi-tours/records`                             | non                    | 2026-07-26 — HTTP 200, `total_count` 24                                                                  | lov2, paternité « Ville de Tours » + date de mise à jour. Filtrer `status='open'` sous peine d'afficher des postes clos. Schéma issu de l'ATS JobAffinity.                                                                                                                                                                                                                                                 |
| Tours Métropole Val de Loire (même portail)                | FR                        | `GET data.tours-metropole.fr/api/explore/v2.1/catalog/datasets/offres-emploi-tmvl/records`                              | non                    | 2026-07-26 — HTTP 200, `total_count` 15                                                                  | lov2, paternité « Tours Métropole Val de Loire ». Volume trop faible pour justifier un connecteur dédié ; consigné parce qu'il confirme la réplicabilité du schéma ODS/JobAffinity.                                                                                                                                                                                                                        |
| Région Île-de-France (ODS data.iledefrance.fr)             | FR                        | `GET data.iledefrance.fr/api/explore/v2.1/catalog/datasets/offres-emploi-region-iledefrance/records`                    | non                    | 2026-07-26 — HTTP 200, `total_count` 219, `modified` 2026-07-26                                          | lov2 (champ `attributions` du portail : null). **Aucune URL de retour par offre** : le renvoi ne peut se faire que vers `iledefrance.fr/region-recrute`, ce qui casse la promesse produit. Champs contractuels présents au schéma mais NULS.                                                                                                                                                               |
| EURES — European Labour Authority                          | ES-PT (endpoint européen) | `POST europa.eu/eures/api/jv-searchengine/public/jv-search/search`                                                      | non                    | 2026-07-26 — HTTP 200, ES `numberRecords` 28 740, PT 1 063 ; plafond `resultsPerPage` 50                 | Mention légale EURES : « Re-use is authorised, provided that ELA is acknowledged as the source of the material. » → afficher « Source : EURES — European Labour Authority » sur chaque résultat, non négociable. Aucun champ salaire. Le lien sortant pointe vers la fiche EURES, pas vers l'annonce d'origine. `locationCodes` est inclusif (~8 % de multi-pays).                                         |
| Manfred (getmanfred.com)                                   | ES                        | `GET www.getmanfred.com/api/v2/public/offers?lang=ES`                                                                   | accord écrit           | 2026-07-26 — HTTP 200, 1 626 offres dont **24 ACTIVE / 1 602 CLOSED** ; statut maintenu après réfutation | CGU 6.3, lues : « En ningún caso este Contenido podrá ser utilizado, reproducido, copiado o transmitido en forma alguna sin el previo consentimiento expreso y por escrito de MANFRED. » Précondition juridique dure, pas une politesse. 4.2.3 vise aussi les liens entrants. Aucun filtrage ni pagination serveur : 2,24 Mo par appel pour ~16-18 offres locales vivantes. Contact : team@getmanfred.com. |
| Net-Empregos (PT) — flux RSS                               | PT                        | `GET www.net-empregos.com/rss.asp`                                                                                      | non (accord souhaité)  | 2026-07-26 — HTTP 200, 1 000 `<item>`, `lastBuildDate` du jour                                           | Seule clause trouvée : « ESTÁ AINDA EXPRESSAMENTE VEDADO AO UTILIZADOR A UTILIZAÇÃO DO NET-EMPREGOS PARA QUAISQUER FINS COMERCIAIS ». Les CGU sont muettes sur le RSS et l'agrégation. Ils syndiquent déjà vers Trovit et Careerjet via des flux nominatifs → demander le même statut. Throttling constaté (curl 56) : espacer les appels. Encodage iso-8859-1.                                            |
| ITJobs.pt — API REST                                       | PT                        | `GET api.itjobs.pt/job/list.json?api_key=…`                                                                             | oui, gratuite (e-mail) | 2026-07-26 — HTTP 200, `{"error":{"message":"Invalid API Key"}}` ; **aucune offre inspectée**            | Aucune CGU d'API publiée : ni `/api` ni `/api/docs` n'énoncent de condition de stockage, redistribution, attribution ou quota. Demander la clé ET les conditions écrites à itjobs@itjobs.pt dans le même message. Ne rien promettre en roadmap avant d'avoir vu une offre.                                                                                                                                 |
| emploi-territorial.fr (fonction publique territoriale)     | FR                        | API et flux RSS existants, non documentés publiquement                                                                  | accord écrit           | 2026-07-26 — `/api/` appelé : page sans endpoint, sans méthode, sans licence ; FAQ lue                   | Les deux canaux sont conçus pour les **employeurs** : le RSS est nominatif et son URL n'est délivrée que dans l'espace employeur (« afficher directement la liste de vos dernières offres d'emplois sur votre site »). Ouvrir un compte employeur pour aspirer serait un détournement de finalité. Seule voie : demande écrite au gestionnaire.                                                            |
| APEC                                                       | FR                        | Aucune API de consultation ; seul un `sitemap_offres_search_engine.xml.gz`                                              | accord écrit           | 2026-07-26 — robots.txt HTTP 200 totalement permissif ; mentions légales corporate lues                  | Clause citée : « Il est donc interdit de reproduire, copier, vendre ou exploiter et de diffuser, de quelque manière que ce soit tout ou partie du contenu du site... sans l'accord préalable de l'Apec ». Le « flux XML » APEC est un canal de **dépôt recruteur**, pas de lecture. Exploiter le sitemap = scraping HTML, exclu.                                                                           |

---

## Ce qui a été appelé et ne marche pas

Cette section a la même valeur que la première : elle évite de refaire le travail. Chaque ligne consigne uniquement ce qui a été réellement observé.

| Source                                                 | Zone     | Statut                                    | Vérifié    | Ce qui a été observé                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------- | ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundesagentur für Arbeit — jobboerse                   | DE       | EXCLUE                                    | 2026-07-26 | HTTP 200 et offres réelles avec l'en-tête `X-API-Key: jobboerse-jobsuche` (extrait de l'app mobile BA) ; HTTP 403 sans clé. CGU §2a(3) : interdiction d'« use existing communication or programming interfaces contrary to the BA's intended purpose ». Le plus gros gisement allemand, techniquement ouvert, juridiquement fermé. Porte légitime : partenariat HR-BA XML (§6b).                                                                                                                               |
| Arbeitnow (DE)                                         | DE       | EXCLUE (corrigée après réfutation)        | 2026-07-26 | Endpoint vivant et frais (100 offres/page, ~700-900 au total). Mais `meta.terms` se subordonne aux CGU, et §2 interdit « any public display (commercial or non-commercial) », « copy », « mirror ». Surtout : **aucun filtrage serveur** — `?search=` et `?tags[]` sont silencieusement ignorés, les paramètres renvoyés sont décoratifs. Le seul mode conforme (passe-plat direct) est impossible ; le seul mode possible (aspiration + index local) est interdit par §2 et par l'architecture sans stockage. |
| job-room.ch (SECO, CH)                                 | CH       | EXCLUE                                    | 2026-07-26 | robots.txt cité intégralement : « # Do not crawl Job Adverts / User-agent: * / Disallow: /job-search/ ». L'endpoint interne du SPA répond (`x-total-count: 68705`) mais n'a pas été exploité au-delà du comptage. L'API officielle `api.job-room.ch/jobAdvertisements/v1` → HTTP 401, et elle sert à **publier**, pas à consommer.                                                                                                                                                                             |
| AMS Autriche — « alle jobs » + HR-API                  | AT       | EXCLUE                                    | 2026-07-26 | `jobs.ams.at/public/emps/jobs` → HTTP 200 mais HTML de SPA. robots.txt : `Allow: /public/emps/` pour **LinkedInBot seul**, `Disallow: /public/emps/` pour tous les autres. La HR-API est entrante (« Mit diesem Service können Sie freie Stellen nahtlos übermitteln »).                                                                                                                                                                                                                                       |
| freelancermap (.de/.at/.ch)                            | DE-AT-CH | EXCLUE                                    | 2026-07-26 | robots.txt totalement permissif (`Disallow:` vide), AGB catégoriques : §11(1) interdit de « weiterzugeben... verbreiten oder veröffentlichen » les informations ; §11(2) interdit toute « gewerbsmäßig weiterzuverarbeiten ». Aucun flux public : `?format=rss` → 301 HTML, `/rss/projekte.xml` → 404.                                                                                                                                                                                                         |
| freelance.de                                           | DE       | EXCLUE                                    | 2026-07-26 | Avertissement juridique dans le robots.txt lui-même : « Die Verwendung von Robotern, Crawlern... ohne die ausdrückliche schriftliche Genehmigung von freelance.de ist strengstens untersagt. » Crawling-Guideline : interdiction de la « Verwendung der Daten durch konkurrierende Plattformen » — MissionPilot en est une. Aucun flux (404).                                                                                                                                                                  |
| jobs.ch                                                | CH       | EXCLUE                                    | 2026-07-26 | robots.txt : `Disallow: /api/` et `Disallow: /api_proxy/`. `/api/` **délibérément non appelé** — le tester serait déjà un passage en force. Premier board privé suisse ; à ne rouvrir que par accord commercial.                                                                                                                                                                                                                                                                                               |
| germantechjobs.de                                      | DE       | MORTE                                     | 2026-07-26 | `/api/jobs` → HTTP 200, corps de 71 octets : « ENDPOINT Deprecated - contact hello@swissdevjobs.ch if you are using it ». Autres chemins → HTML de SPA ou 404. Porte ouverte explicite : l'exploitant invite au contact.                                                                                                                                                                                                                                                                                       |
| swissdevjobs.ch                                        | CH       | MORTE                                     | 2026-07-26 | Même message, même exploitant que germantechjobs.de. Seul candidat suisse crédible restant. Un seul e-mail à hello@swissdevjobs.ch couvrirait DE + CH.                                                                                                                                                                                                                                                                                                                                                         |
| opendata.swiss                                         | CH       | EXCLUE                                    | 2026-07-26 | HTTP 403 sans User-Agent, 200 avec. Contenu : agrégats statistiques (« Offene Stellen pro Monat nach gesuchtem Beruf und NOGA »), ni titre de poste, ni employeur, ni lien. Exclue pour nature, pas pour droit.                                                                                                                                                                                                                                                                                                |
| data.gv.at — AMS Open Government Data                  | AT       | EXCLUE (vérification incomplète, assumée) | 2026-07-26 | L'API CKAN au chemin testé → HTTP 404, jeu ciblé → 404. **Aucun appel réussi** : la nature statistique n'est établie que par les intitulés publiés, pas par une réponse obtenue. Licences non lues.                                                                                                                                                                                                                                                                                                            |
| Berlin Startup Jobs — RSS                              | DE       | NON_VERIFIE                               | 2026-07-26 | Flux propre et vivant : HTTP 200, 12 items, vraies offres, dates de juillet 2026 ; robots.txt autorise nommément Scrapy. Mais `/terms/`, `/terms-of-service/`, `/terms-of-use/`, `/legal/` → tous 404 : **aucune CGU n'existe**, donc aucune permission écrite nulle part. 12 offres, Berlin uniquement.                                                                                                                                                                                                       |
| karriere.at                                            | AT       | NON_VERIFIE                               | 2026-07-26 | robots.txt seul appelé : bloque BLEXBot et AhrefsBot, permissif pour le reste, 13 sitemaps. **Aucun endpoint de données testé, CGU non lues.** Premier board privé AT — à instruire, pas à classer sur la foi d'un robots.txt.                                                                                                                                                                                                                                                                                 |
| devjobs.at                                             | AT       | NON_VERIFIE                               | 2026-07-26 | La requête au robots.txt renvoie une page « Vercel Security Checkpoint » (challenge anti-bot JS). Non contourné. Rien d'accessible, y compris le robots.txt. Voie possible : contact humain.                                                                                                                                                                                                                                                                                                                   |
| Free-Work (ex Freelance-info)                          | FR       | EXCLUE                                    | 2026-07-26 | robots.txt HTTP 200 : aucun chemin RSS/feed/API référencé, et `Disallow: /` nommément pour OAI-SearchBot, AdIdxBot, Wget, HTTrack, Nutch, MJ12bot. Seule voie technique restante = scraping HTML. Le créneau freelance/portage tech FR reste **non couvert**.                                                                                                                                                                                                                                                  |
| Human Coders Jobs                                      | FR       | MORTE                                     | 2026-07-26 | `jobs.humancoders.com/jobs.rss` → HTTP 301 cross-host vers la home `humancoders.com`, qui ne mentionne plus aucun board. Signature d'un service décommissionné. Ressort encore dans les listes de « boards tech FR » périmées.                                                                                                                                                                                                                                                                                 |
| RemixJobs                                              | FR       | MORTE                                     | 2026-07-26 | `connect ECONNREFUSED 217.70.184.50:443`. DNS vivant (domaine probablement parqué chez Gandi), port 443 fermé. Ni 404 ni timeout : plus aucun service.                                                                                                                                                                                                                                                                                                                                                         |
| France Travail — republication Seine-Saint-Denis (ODS) | FR       | NON_VERIFIE — **non appelé**              | 2026-07-26 | Vu uniquement dans le catalogue data.gouv : licence `lov2`, `last_update` 2026-07-13, formats CSV/JSON/GeoJSON/ZIP (signature ODS). L'endpoint `/records` n'a **pas** été interrogé. On ignore s'il contient des offres nominatives ou un agrégat.                                                                                                                                                                                                                                                             |
| Apave — flux RSS emploi                                | FR       | NON_VERIFIE                               | 2026-07-26 | Flux appelé et fonctionnel : RSS 2.0 valide, 20 items, liens retour, `pubDate` RFC-822, préfiltrage serveur par région/département/contrat. **Mentions légales non lues** → impossible d'écrire INTEGRABLE sans mentir sur le niveau de preuve. Deux limites structurelles : plafond 20 items, mono-employeur.                                                                                                                                                                                                 |
| InfoJobs (ES) — API officielle                         | ES       | EXCLUE                                    | 2026-07-26 | HTTP 401 sans authentification ; CGU d'API lues intégralement. Interdictions citées : « Usar los contenidos o datos de InfoJobs para crear otro portal de empleo », et interdiction des applications qui sont des « agregadores de ofertas ». MissionPilot est littéralement l'objet de l'interdiction.                                                                                                                                                                                                        |
| Landing.jobs (PT) — API v1                             | PT       | EXCLUE                                    | 2026-07-26 | HTTP 200 sans clé, 50 offres, **le meilleur schéma de la zone** (salaire brut min/max, `remote`, `expires_at`, URL sortante). Mais CGU : interdiction d'« use... scripts, robots or any other means... to access, monitor, scrape or copy the Platform », et robots.txt : `Disallow: /api/`. Accessible ≠ autorisé.                                                                                                                                                                                            |
| Tecnoempleo (ES)                                       | ES       | EXCLUE                                    | 2026-07-26 | robots.txt seul appelé, puis arrêt volontaire : il bloque nommément `AnthropicBot`, `Claude`, `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `Claude-SearchBot`. Second motif indépendant : `Disallow: /alertas-empleo-rss.php` pour tous les agents. Aucun contenu récupéré.                                                                                                                                                                                                                                      |
| IEFP via dados.gov.pt                                  | PT       | EXCLUE                                    | 2026-07-26 | Un seul jeu correspondant, publié par l'INE : comptages mensuels par centre d'emploi. CC BY 4.0 mais aucune annonce individuelle. Le seul chemin vérifié vers les offres IEFP est leur remontée dans EURES.                                                                                                                                                                                                                                                                                                    |
| datos.gob.es                                           | ES       | EXCLUE                                    | 2026-07-26 | Jeux INE/ISTAC : demandeurs inscrits, taux d'emploi, ventilations sectorielles. Aucun champ d'offre. En complément : `empleate.gob.es/` et `empleate.gob.es/empleo/api/ofertas` renvoient tous deux 8 457 octets de HTML — catch-all de SPA, pas une API.                                                                                                                                                                                                                                                      |
| BEP — Bolsa de Emprego Público (PT)                    | PT       | EXCLUE                                    | 2026-07-26 | Flux RSS supposé → HTTP 302 vers leur page « ErroPaginaNaoEncontrada » : il n'existe pas. Page d'offres → HTTP 200 text/html. robots.txt → 404. Seule voie restante : scraping HTML, exclu.                                                                                                                                                                                                                                                                                                                    |
| UWV / werk.nl                                          | NL       | EXCLUE                                    | 2026-07-26 | Demande de données officielle n°2258 (data.overheid.nl), statut « Afgehandeld ». Réponse UWV citée : « Werk.nl beschikt helaas niet over een API van alle vacatures. » L'UWV renvoie explicitement au scraping — exclu par les règles du projet. Aucune API à appeler.                                                                                                                                                                                                                                         |

Trois cas confirment la même règle et méritent d'être cités ensemble : **freelancermap**, **APEC** et **Manfred** ont un robots.txt permissif et des conditions d'utilisation prohibitives. Un robots.txt ouvert n'est jamais un consentement.

---

## Ce que cette passe n'a PAS tranché

**Lacune de couverture du rapport lui-même**

- Le bloc NL-BE-LU reçu est **tronqué** : seule la source UWV / werk.nl y est documentée en détail. Les affirmations de tête de zone — fermeture de la JOB API / TICC au 1er décembre 2025, Luxembourg ne publiant que des offres clôturées sans titre ni lien, pistes CSO/SAP via P-Direkt et werkenvoor.be — **ne sont adossées à aucune fiche de preuve dans ce que j'ai reçu**. Ne pas les traiter comme vérifiées. La zone est à re-auditer intégralement.
- **Deux zones sur quatre ressortent avec zéro source INTEGRABLE** : DE-AT-CH et NL-BE-LU. Ce n'est pas un détail de registre, c'est un trou de couverture produit.

**Promesses produit non tenables en l'état**

- **Salaire** : aucun champ exploitable sur l'ensemble des sources retenues. Les deux seules sources à publier des fourchettes — Manfred et Landing.jobs — sont respectivement bloquée par accord préalable et exclue. Chez BPCE, `salary_min`/`salary_max` existent mais étaient nuls sur l'échantillon, et l'échantillon complet n'a pas été testé.
- **Télétravail** : absent partout sauf en texte libre. Un filtre télétravail ne peut pas être promis sur ces zones.
- Conséquence non tranchée : soit ces filtres disparaissent de la promesse, soit une source payante entre dans le périmètre. La question n'a pas été posée.

**Liens retour — le point qui casse le modèle produit**

- **BPCE** : le lien retour appelé (`recrutement.bpce.fr/job/…`) est une SPA JavaScript qui n'a renvoyé que le texte « BPCE ». **Il n'est pas établi que l'annonce s'affiche pour un utilisateur final.** À vérifier dans un navigateur avant de shipper ; si les pages sont vides, la meilleure source FR ne tient plus sa promesse.
- **Choisir le Service Public** : aucun lien retour. L'hypothèse d'une URL reconstructible depuis la colonne `Référence` (`O033260101000001`) n'a **pas** été testée.
- **Région Île-de-France** : aucun lien retour, et aucune demande n'a été adressée à la Région pour l'ajout d'une URL par offre.
- **EURES** : le lien pointe vers la fiche du portail, pas vers l'annonce d'origine — un saut supplémentaire pour l'utilisateur, jamais arbitré.

**Fraîcheur et sémantique des données**

- **Choisir le Service Public** : le fichier semble être un cumul annuel (postes de janvier 2026 dans l'échantillon), pas un instantané. Le filtre `Statut du poste = "Vacant"` est présumé fiable — **non vérifié**.
- **Région IDF** : `vacancy_activation_date` valait 2026-09-07, une date **future**. Le sens du champ (activation de la publication ? prise de poste ?) n'est pas établi. Ne pas le mapper sur « date de publication ».
- **BPCE** : pas de date de publication, seul `lastmodifieddate` au format non-ISO « 24/07/2026 4:53:33 PM », à parser explicitement.

**Questions juridiques ouvertes**

- **Republication France Travail sous lov2** : une republication sous Licence Ouverte fait-elle échapper l'usage aval aux conditions de France Travail ? Non tranché — et c'est la question qui décide si le contournement de la panne d'identifiants OAuth2 est licite. La panne elle-même reste non résolue.
- **EURES** : la mention légale ne cite ni la décision 2011/833/UE ni CC BY 4.0, et prévoit que « the general principle of re-use... may be subject to specific conditions as indicated in individual copyright notices ». La portée exacte de l'autorisation sur des annonces produites par un service public national (IEFP, par exemple) n'a pas été instruite.
- **APEC** : la clause invoquant le droit du producteur de bases de données (L.343-1 CPI) est apparue dans un extrait de recherche mais **n'a pas pu être ouverte** — page en 404, sous-domaine `cadres.apec.fr` en échec DNS. La seule clause réellement lue ne couvre que `corporate.apec.fr`.
- **Net-Empregos** : la clause anti-usage commercial est présumée non bloquante au motif que MissionPilot est personnel et non commercial. Cette présomption n'est pas confirmée et **ne survivrait pas** à un changement de modèle. Aucune clause n'autorise par ailleurs un tiers agrégateur.
- **Berlin Startup Jobs** : un flux RSS publié par l'éditeur, plus un robots.txt autorisant nommément Scrapy, valent-ils consentement en l'absence totale de CGU ? Question posée, non tranchée.
- **Dette d'attribution** : le badge « Jobs by Adzuna » manquant est toujours ouvert. L'attribution EURES (« Source : EURES — European Labour Authority ») et l'attribution lov2 (Concédant + date) créent la même dette si elles ne sont pas implémentées **avant** mise en ligne.

**Instructions non exécutées**

- **germantechjobs.de + swissdevjobs.ch** : même exploitant, e-mail à hello@swissdevjobs.ch **non envoyé**. C'est la démarche la moins coûteuse identifiée (couverture tech DE + CH d'un seul contact) et elle n'a pas été faite.
- **Manfred** : demande non envoyée. À noter avant d'investir — ce qu'on demanderait ne vaut que ~16-18 offres espagnoles vivantes, sans champ stack, sans type de contrat, sans champ URL.
- **ITJobs.pt** : clé non demandée, donc **aucun champ connu**. Toute affirmation sur son salaire, son contrat ou sa fraîcheur serait de la spéculation.
- **emploi-territorial.fr** : le recouvrement avec le versant « Fonction Publique Territoriale » de Choisir le Service Public n'a **pas été mesuré**. Sans cette mesure, la démarche partenariale peut être redondante.
- **karriere.at** : Nutzungsbedingungen non lues. Premier board privé autrichien laissé en friche.
- **Connecteur ODS générique** : l'hypothèse qu'un connecteur unique paramétré (portail + dataset id) couvre toutes les collectivités publiant via JobAffinity repose sur **deux** jeux de données, tous deux du même portail tourangeau. Aucune autre collectivité n'a été testée. C'est le levier principal identifié sur la zone FR et il n'est pas validé.

---

_Dernière passe de veille complète : **2026-07-25**. Toute ligne dont la date de
vérification dépasse trois mois doit être considérée comme périmée jusqu'à
nouvelle vérification._
