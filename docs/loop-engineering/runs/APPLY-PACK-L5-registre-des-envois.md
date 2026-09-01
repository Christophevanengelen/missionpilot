# Task Loop Record — Apply Pack L5 : le registre des envois

- **schemaVersion**: 1.0
- **taskId**: APPLY-PACK-L5
- **goal**: donner au produit une mémoire de ce qui est réellement parti — quand, par quel canal, avec quel CV, et si c'est arrivé — pour que « est-ce que j'ai déjà postulé ici » soit une lecture et non une supposition.
- **status**: completed
- **stopReason**: boucle close avec preuves ; fusion en attente du gate humain (PR #108)
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
- Même motif RLS que `cv_variants` et `ai_application_drafts`. **Écart assumé sur les grants** : pas de `service_role`, justifié dans la migration.
- Pas de contrainte d'unicité sur (profil, opportunité) seul : plusieurs envois
  légitimes existent (relance, deuxième agence sur le même mandat). Le 01/09 chez
  Proximus, deux cabinets chassaient le même siège — le modèle doit le permettre.
  **La première version l'affirmait et ne le tenait pas** : sans `recipient` dans
  la clé, T-Crew et Hays étaient le même `(profil, offre, 'agency', jour)`. Le
  relecteur d'implémentation l'a mesuré sur PG 17.7 ; corrigé et remesuré.

## Risks

| Risque                                                  | Parade                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Une contrainte trop stricte bloque une relance légitime | La clé d'unicité inclut le JOUR et le CANAL, pas seulement l'opportunité |
| La date d'unicité dérive avec le fuseau                 | Colonne générée `sent_on` en UTC, déterministe et immuable               |
| Table oubliée dans l'export art. 20                     | `PERSONAL_TABLES` + test `politique-tables` qui casse                    |
| Table hors cascade d'effacement                         | Test pgTAP `account_deletion` qui casse                                  |
| `cv_variant_id` pointant vers le CV d'un autre profil   | FK composite `(profile_id, cv_variant_id)`                               |

## Checks

| Check  | Command             | Result                                                                                                                                                 |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format | `pnpm format:check` | passed                                                                                                                                                 |
| Lint   | `pnpm lint`         | passed                                                                                                                                                 |
| Types  | `pnpm typecheck`    | passed                                                                                                                                                 |
| Unit   | `pnpm test`         | passed                                                                                                                                                 |
| RLS    | `pnpm test:rls`     | **passed en CI** — `application_dispatches_rls.test.sql .. ok`, 16 fichiers / 303 assertions, Result: PASS. Non exécutable localement (Docker absent). |
| Build  | `pnpm build`        | passed                                                                                                                                                 |

## Review

- implementation-reviewer : **fait** — 1 BLOCKER (B1 : la contrainte refusait deux cabinets sur le même mandat le même jour, mesuré sur PG 17.7), 3 MAJOR, 5 mineurs. Tous réparés (`ab7d61d`), correction remesurée sur les huit cas.
- security-reviewer : **fait** — aucun blocker. 3 MAJOR (données de tiers non couvertes en §7, « seize familles » art. 20 périmé, contradiction offres consultées/importées) et 4 MINOR, tous réparés dans le commit de réparation.

## Stop conditions

- Trois tentatives échouées sur la même vérification.
- Toute modification du tenet « prepare, don't send ».
- Fusion vers `main` : gate humain, jamais automatique.

## Ce que la boucle a réellement appris

**Un test qui affirme une couverture qu'il n'a pas est pire qu'un test absent.**
L'assertion « two agencies chased the same seat » insérait un autre canal. Elle
passait, la CI passait, et le défaut B1 traversait tout — jusqu'à ce qu'un
relecteur monte un PostgreSQL et rejoue le DDL au lieu de le lire. La première
exécution CI de cette branche est verte sur le code fautif : c'est la preuve que
le vert d'une CI ne vaut que ce que valent les assertions.

**Prouver que ça marche n'est pas prouver que ça refuse.** Les dix-huit
assertions d'origine couvraient les quatre verbes en positif et un seul en
négatif. Un `with check (true)` sur la policy INSERT — la plus dangereuse de la
table — n'en aurait fait tomber aucune.

**La même dérive de comptage habitait trois endroits.** La politique disait 23
tables en §3 et 16 en §21 ; la phrase de portabilité disait « seize familles »
pour vingt ; `export.ts` et son test disaient « 16 sections ». Corriger un
chiffre ne corrige rien : ce qui protège, c'est de lier l'affirmation à la
constante du code, et d'accepter que deux comptes différents (24 tables, 20
familles) ne se remplacent pas l'un l'autre.
