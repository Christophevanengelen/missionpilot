# Task Loop Record — Apply Pack L5 : le registre des envois

- **schemaVersion**: 1.0
- **taskId**: APPLY-PACK-L5
- **goal**: donner au produit une mémoire de ce qui est réellement parti — quand, par quel canal, avec quel CV, et si c'est arrivé — pour que « est-ce que j'ai déjà postulé ici » soit une lecture et non une supposition.
- **status**: in-progress
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt**: 2026-09-01T20:40:00Z

## L'incident qui motive la tâche

Le 2026-09-01, une lettre d'acceptation partie à 15:27 a été renvoyée à 19:58 au
même recruteur, en pleine négociation de TJM. Cause : l'état d'envoi avait été
DÉDUIT de la présence d'un brouillon résiduel, au lieu d'être LU dans un registre.
Le seul fichier de suivi existant contenait une ligne, et son statut affirmait
« brouillon prêt » alors que le message était parti deux heures plus tôt.

Le même jour, un mail d'approche d'août 2026 (Orbis) a échoué à la remise pendant
quatre jours sans que rien ne le signale.

Ces deux incidents partagent une racine : **le produit n'enregistre aucun
événement d'envoi**. `opportunity_tracking` stocke un ÉTAT courant (`stage`),
réécrit à chaque changement. Un état ne peut répondre ni « quand », ni « par quel
canal », ni « est-ce arrivé », ni « combien de fois ».

## Acceptance criteria

- [x] Une table d'événements `application_dispatches` : une ligne = un envoi réel. **Pas en ajout seul** — `update` et `delete` sont accordés au propriétaire, parce qu'on corrige une date d'envoi et qu'on enregistre une réponse reçue après coup. Le dépôt sait faire de l'ajout seul quand il le veut (`tone_contracts` n'accorde que `select, insert`) ; ce n'est pas le cas ici, et le dire est plus honnête que de l'écrire.
- [x] Le doublon exact du 01/09 est refusé **par le schéma**, pas par du jugement : contrainte d'unicité sur (profil, opportunité, canal, jour).
- [x] Un renvoi légitime un autre jour, ou par un autre canal, reste possible : la contrainte refuse la répétition, pas le suivi.
- [x] Le statut de remise est un champ de première classe, `unknown` par défaut — un rebond doit pouvoir être enregistré et vu.
- [x] Le canal est contraint à une liste fermée, pour que « qu'est-ce qui marche » se réponde par un `group by`.
- [x] La variante de CV envoyée est référencée, et ne peut pas venir d'un autre profil (FK composite).
- [x] RLS propriétaire sur les quatre verbes ; `revoke all` avant les grants ; **`service_role` sans aucun grant** — écart assumé au motif maison, justifié dans la migration : aucun chemin serveur ne touche cette table, et elle contient les coordonnées de tiers.
- [x] La table entre dans `PERSONAL_TABLES` (export art. 20) et dans le décompte de la politique de confidentialité.
- [ ] La table atteint `auth.users` par cascade (test pgTAP `account_deletion`).
- [ ] `pnpm verify` vert.

## Constraints

- **Le produit n'envoie rien.** Le tenet `prepare, don't send` tient : cette table
  enregistre ce que l'humain a envoyé lui-même, elle ne déclenche aucun envoi.
- Aucune dépendance de production nouvelle.
- Même motif RLS + grants que `cv_variants` et `ai_application_drafts`.
- Pas de contrainte d'unicité sur (profil, opportunité) seul : plusieurs envois
  légitimes existent (relance, deuxième agence sur le même mandat). Le 01/09 chez
  Proximus, deux cabinets chassaient le même siège — le modèle doit le permettre.

## Risks

| Risque                                                  | Parade                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Une contrainte trop stricte bloque une relance légitime | La clé d'unicité inclut le JOUR et le CANAL, pas seulement l'opportunité |
| La date d'unicité dérive avec le fuseau                 | Colonne générée `sent_on` en UTC, déterministe et immuable               |
| Table oubliée dans l'export art. 20                     | `PERSONAL_TABLES` + test `politique-tables` qui casse                    |
| Table hors cascade d'effacement                         | Test pgTAP `account_deletion` qui casse                                  |
| `cv_variant_id` pointant vers le CV d'un autre profil   | FK composite `(profile_id, cv_variant_id)`                               |

## Checks

| Check  | Command             | Result                                                                                           |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| Format | `pnpm format:check` | passed                                                                                           |
| Lint   | `pnpm lint`         | passed                                                                                           |
| Types  | `pnpm typecheck`    | passed                                                                                           |
| Unit   | `pnpm test`         | passed                                                                                           |
| RLS    | `pnpm test:rls`     | **NON EXÉCUTÉ ici** — ni Docker ni CLI Supabase sur cette machine. La CI (job `stack`) le lance. |
| Build  | `pnpm build`        | passed                                                                                           |

## Review

- implementation-reviewer : pending
- security-reviewer : **fait** — aucun blocker. 3 MAJOR (données de tiers non couvertes en §7, « seize familles » art. 20 périmé, contradiction offres consultées/importées) et 4 MINOR, tous réparés dans le commit de réparation.

## Stop conditions

- Trois tentatives échouées sur la même vérification.
- Toute modification du tenet « prepare, don't send ».
- Fusion vers `main` : gate humain, jamais automatique.
