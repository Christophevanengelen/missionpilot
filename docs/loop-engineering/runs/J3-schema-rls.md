# Task Loop Record — J3: Initial schema + RLS + pgTAP

- **schemaVersion**: 1.0
- **taskId**: J3
- **goal**: Four Phase 0 tables aligned on DOMAIN_MODEL.md, RLS enabled in the same migration as each table, explicit least-privilege grants, SECURITY DEFINER trigger with fixed search_path, pgTAP suite proving denials and owner access, TypeScript types generated after a successful reset.
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (1 = implementation + grant-model discovery; 2 = review repairs)
- **startedAt** / **completedAt**: 2026-07-22T19:00:00+02:00 / 2026-07-22T19:40:00+02:00

## Acceptance criteria (including user-mandated additions)

- [x] `handle_new_user` : SECURITY DEFINER + `set search_path = ''`, références qualifiées, idempotent (ON CONFLICT) ; `set_updated_at` : search_path fixé aussi
- [x] Aucune donnée sensible ni identifiant réel (emails `*@test.local`, UUID synthétiques, seed vide de données)
- [x] pgTAP prouve : anonyme ne lit rien (refus 42501 aux 4 tables) · A ne lit/modifie pas B (les deux sens, fixtures A ET B) · authenticated n'écrit pas les tables opérationnelles (5 refus) · accès propriétaire fonctionnels (lecture + update display_name)
- [x] RLS activée dans la même migration que chaque CREATE TABLE
- [x] Types générés uniquement après `db reset` réussi (ordre respecté, 2×)
- [x] Clé admin confinée, absente des tests RLS (rôles anon/authenticated + request.jwt.claims uniquement)
- [x] Champs DOMAIN_MODEL (entity_type/id, estimated_cost, input/output_hash, UNIQUE(run_id,step_name,attempt), idempotency_key UNIQUE)

## Actions (files)

Created: `supabase/migrations/20260722163150_init_phase0_schema.sql`, `supabase/tests/rls_policies.test.sql` (28 assertions), `supabase/seed.sql` (commentaire seul), `src/lib/db/database.types.ts` (généré). Modified: `src/lib/db/{server,client,admin}.ts` (générique `Database`), `package.json` (test:rls, db:types, db:reset).

## Checks (evidence)

| Check                                               | Command             | Result         |
| --------------------------------------------------- | ------------------- | -------------- |
| Migration rejouée sur base vide (×2)                | `supabase db reset` | passed         |
| Trigger provisionne le profil (dev user + fixtures) | psql + pgTAP test 1 | passed         |
| Suite RLS complète                                  | `pnpm test:rls`     | passed (28/28) |
| Gate applicatif                                     | `pnpm verify`       | passed (13/13) |
| Auth e2e après reset                                | `pnpm test:e2e`     | passed (4/4)   |

## Review findings

| Reviewer                | Severity | Finding                                                                                 | Resolution                                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| security-reviewer       | major    | La clause WITH CHECK anti-transfert de propriété n'était exercée par aucun test         | fixed (throws_ok transfert + vérification postgres ; +grant colonne)                       |
| impl + security         | minor    | Grant UPDATE table entière → owner pouvait modifier id/created_at/status                | fixed (grant colonne `display_name` seul + test statut refusé)                             |
| security-reviewer       | minor    | EXECUTE public par défaut sur les 2 fonctions                                           | fixed (revoke)                                                                             |
| security-reviewer       | info     | DELETE service_role sur tables de trace append-only                                     | fixed (retiré ; conservé sur candidate_profiles pour la suppression-vie-privée documentée) |
| implementation-reviewer | info     | Isolation opérationnelle prouvée dans un seul sens                                      | fixed (fixture run B + 3 assertions symétriques)                                           |
| security-reviewer       | info     | display_name dérivé de l'email = non fiable à l'affichage quand l'inscription s'ouvrira | accepted (noté pour Phase 1 ; échappement React par défaut)                                |

Découverte d'implémentation (tentative 1) : la CLI moderne n'accorde **aucun privilège utile par défaut** (et laissait TRUNCATE à anon) → bloc revoke/grant explicite par table ; refus anonymes au niveau GRANT (plus fort que la RLS seule).

Reports J4 : writes via service client ⇒ contrôle de propriété explicite obligatoire (RLS sans effet sur ce chemin) ; transitions de statut non contraintes en base ⇒ machine à états dans le code workflow ; route `/api/inngest` hors proxy ⇒ vérification de signature obligatoire ; `INNGEST_SIGNING_KEY` requis en production.

## Next action

Await user approval, then J4 (Inngest system-health workflow).

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; security-reviewer major repaired and re-proven by tests
