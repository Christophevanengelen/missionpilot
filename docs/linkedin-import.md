# Importer un profil LinkedIn — ce qui est possible, et ce qui ne l'est pas

**Enquête du 2026-07-26**, menée sur les sources primaires (documentation
LinkedIn), chaque capacité annoncée étant ensuite attaquée par un vérificateur
adverse. Ce document existe pour qu'on ne refasse pas ce travail dans six mois.

## La décision

**On garde l'import par l'export officiel `.zip`.** L'API LinkedIn accessible à
ce projet ne renvoie pas un champ de plus, et coûte une corvée récurrente.

## Ce qui a été vérifié

| Voie                                        | Accès réel                                                                            | Ce qu'elle donne                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Member Data Portability API (Member)**    | **Self-service**, sans revue humaine. Réservée aux membres localisés **EEE / Suisse** | Exactement la matière du `.zip` : l'export CSV resérialisé en JSON. **Aucun champ neuf** |
| **Member Data Portability API (3rd Party)** | **Fermée** — exige une page entreprise vérifiée, raison sociale, adresse enregistrée  | La même chose, mais pour d'autres membres, avec un vrai OAuth                            |
| **Sign In with LinkedIn (OpenID Connect)**  | Ouverte                                                                               | Une identité : nom, photo, e-mail. **Ni postes, ni compétences, ni recommandations**     |
| **Member Changelog API**                    | via (Member)                                                                          | Flux d'activité sur **28 jours glissants**, messages privés inclus                       |
| **`r_fullprofile`, `r_liteprofile`, v1**    | **Fermées / dépréciées** (v1 le 2019-05-01, `r_liteprofile` le 2023-08-01)            | —                                                                                        |
| **Talent Solutions, Marketing Platform**    | **Partenaires approuvés** uniquement                                                  | —                                                                                        |

## Pourquoi c'est non, en trois points

1. **Aucun gain de données.** L'API (Member) renvoie les mêmes domaines que
   l'archive. Le seul gain serait de supprimer la manipulation du `.zip`.
2. **Un coût récurrent à la place.** Les jetons ont une durée de vie de 60 jours
   et le rafraîchissement programmatique est réservé à un ensemble limité de
   partenaires. On échangerait « je dépose mon `.zip` quand mon profil bouge »
   contre « je régénère un jeton dans le portail développeur tous les deux mois ».
3. **Un mur héréditaire pour l'open source.** Les conditions interdisent de
   divulguer les identifiants d'accès. Aucun `client_id` ni jeton dans le dépôt :
   chaque personne qui auto-héberge devrait créer sa propre application — et si
   elle sert quelqu'un d'autre qu'elle-même, repasser par la vérification
   d'entreprise, impossible avec une adresse e-mail personnelle.

## Ce qu'aucune voie ne donne, contrairement à ce qu'on croit

**Taille d'équipe, budget géré, périmètre, effectif encadré, autonomie de
décision.** Aucun de ces signaux n'est un champ, dans aucun domaine, dans aucune
API. `POSITIONS` ne porte qu'intitulés, entreprises, lieux, dates et
descriptions.

C'est le cœur de la promesse du produit — lire une carrière comme une
trajectoire — et LinkedIn ne le fournit pas. Il restera inféré du texte libre.

## Ce que l'enquête a réellement rapporté

La matière la plus riche était **déjà dans l'archive**, et le parseur ne la
lisait pas. Il prenait quatre fichiers sur les dizaines exportées.

- **`Recommendations_Received.csv`** — le seul texte d'un profil écrit par
  quelqu'un d'autre, et routinièrement l'endroit où figure le périmètre qu'un CV
  omet. Lu depuis le 2026-07-26, **attribué** et jamais fondu dans le récit de la
  personne, et limité aux recommandations réellement publiées.
- **`Job Seeker Preferences.csv`** — le seul signal de tout l'export qui parle de
  la marche _suivante_ plutôt que de la précédente.

Les consignes d'export affichées à l'utilisateur ont été corrigées en
conséquence : sans elles, ces fichiers ne seraient jamais dans l'archive.

## À rouvrir si

- **Une société existe.** La variante 3rd Party redevient instruisible, et avec
  elle un vrai bouton « Connecter LinkedIn ».
- **Le parseur a besoin d'un domaine qu'on n'a pas.** `INFERENCE_TAKEOUT` et
  `PROFILE_SUMMARY` sont les seuls lots dont on ignore s'ils figurent dans le
  `.zip` — « comment le marché me lit » plutôt que « comment je me décris ».
  Hypothèse à tester, pas acquis.

## Ce qui reste interdit, quelle qu'en soit la tentation

Le **scraping de LinkedIn**, définitivement. La question ci-dessus ne porte que
sur les API officielles, avec le consentement explicite du membre. Un
`robots.txt` permissif ne serait pas un consentement, et une API fermée n'est pas
une invitation à passer par la fenêtre.
