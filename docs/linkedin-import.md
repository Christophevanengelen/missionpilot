# Importer un profil LinkedIn — ce qui est possible, et ce qui ne l'est pas

**Enquête du 2026-07-26**, menée sur les sources primaires (documentation
LinkedIn), chaque capacité annoncée étant ensuite attaquée par un vérificateur
adverse. Ce document existe pour qu'on ne refasse pas ce travail dans six mois.

## La décision

**On garde l'import par l'export officiel `.zip`.** L'API LinkedIn accessible à
ce projet ne renvoie pas un champ de plus, et coûte une corvée récurrente.

## Ce qui a été vérifié

| Voie                                                           | Accès réel                                                                                                  | Ce qu'elle donne                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Member Data Portability API (Member)**                       | **Self-service**, sans revue humaine. Réservée aux membres localisés **EEE / Suisse**                       | Exactement la matière du `.zip` : l'export CSV resérialisé en JSON. **Aucun champ neuf** |
| **Member Data Portability API (3rd Party)**                    | **Fermée** — exige une page entreprise vérifiée, raison sociale, adresse enregistrée                        | La même chose, mais pour d'autres membres, avec un vrai OAuth                            |
| **Sign In with LinkedIn (OpenID Connect)**                     | Ouverte                                                                                                     | Une identité : nom, photo, e-mail. **Ni postes, ni compétences, ni recommandations**     |
| **Member Changelog API**                                       | via (Member)                                                                                                | Flux d'activité sur **28 jours glissants**, messages privés inclus                       |
| **`r_fullprofile`** — postes, compétences, formations, projets | **Fermé.** Verbatim : « Access to `r_fullprofile` is now closed. » **Aucune procédure de demande n'existe** | Exactement la matière recherchée — et inatteignable                                      |
| **`r_liteprofile`, API v1**                                    | Dépréciées (v1 le 2019-05-01, `r_liteprofile` le 2023-08-01)                                                | —                                                                                        |
| **`w_member_social`**                                          | Ouverte, self-service                                                                                       | **Aucune donnée en lecture** : c'est une permission d'ÉCRITURE (publier, commenter)      |
| **Talent Solutions, Marketing Platform**                       | **Partenaires approuvés** uniquement                                                                        | —                                                                                        |

## Le plafond est documenté, il n'y a rien à chercher de plus

Le _discovery document_ OIDC borne officiellement le programme :
`scopes_supported = ["openid", "profile", "email"]`. Il n'existe pas de scope
caché qu'on aurait manqué — le plafond est atteint dès le premier appel.

Et `r_fullprofile`, le seul scope qui exposerait vraiment un parcours, n'est pas
« difficile à obtenir » : il est **fermé**, sans procédure de demande. Ce n'est
pas une négociation à tenter, c'est une porte murée.

## Deux pièges à connaître avant d'écrire une ligne de code

**Ne jamais demander `w_member_social`.** Ce scope ne lit rien : il autorise à
publier et commenter _au nom_ du membre. L'afficher sur l'écran de consentement,
dans un produit qui promet de ne jamais agir à la place de quelqu'un, coûte de la
confiance pour zéro donnée.

**`headline` : deux pages primaires de LinkedIn se contredisent.** La page
« Getting Access » annonce que le scope `profile` renvoie « name, headline, and
photo », mais `headline` n'apparaît ni dans le schéma de réponse de
`/v2/userinfo`, ni dans les `claims_supported` du discovery document. À traiter
comme **indisponible** tant qu'un appel réel ne l'a pas prouvé.

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

## Le test qui tranche, en une heure

Si tu veux clore la question par la preuve plutôt que par la lecture — et c'est
légitime :

1. **Vérifie d'abord ta localisation LinkedIn.** L'accès (Member) est déterminé
   par le lieu déclaré sur ton profil. Hors EEE/Suisse, la piste est close
   immédiatement et le test est inutile.
2. Crée l'app **sur la page société imposée par LinkedIn** (« Member Data
   Portability (Member) Default Company ») — surtout n'en crée pas une nouvelle.
3. Accepte les CGU, génère un jeton via l'OAuth Token Generator du portail, et
   appelle une fois la Snapshot API sur le domaine `POSITIONS`.

Ce que ce test établit et qu'aucune lecture ne peut établir : le **contrat de
champs réel**. La documentation ne type `snapshotData` que comme « JSON Key
Value », sans aucune référence de champs par domaine. On ne peut donc pas
concevoir un modèle contre ce schéma avant d'avoir appelé une fois.

## Si tu veux quand même un bouton « Se connecter avec LinkedIn »

C'est faisable et sans revue humaine, mais que pour le **confort de connexion** —
aucune donnée de parcours. Ce qui dépend de toi : créer une Page LinkedIn
« MissionPilot » et en être super admin (une app doit être rattachée à une Page),
puis publier des CGU et une politique de confidentialité accessibles — les API
Terms l'exigent explicitement, même avec un seul utilisateur.

Côté implémentation : stocker `sub`, **jamais l'e-mail** (documenté comme
optionnel, et `subject_types_supported = pairwise` signifie que le `sub` est
propre à chaque application). Ne jamais présenter `email_verified` comme une
identité vérifiée : LinkedIn l'interdit explicitement pour ce produit.

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
