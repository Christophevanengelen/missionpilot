# Task Loop Record — J4: Inngest system-health workflow

- **schemaVersion**: 1.0
- **taskId**: J4
- **goal**: Durable, idempotent system-health workflow (Inngest v4) with a state machine, a confined privileged write path with explicit ownership checks, a DAL-protected diagnostics page — all proven by deterministic tests against the database, never by the Inngest UI.
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (1 = implementation; 2 = review repairs)
- **startedAt** / **completedAt**: 2026-07-22T19:45:00+02:00 / 2026-07-22T20:40:00+02:00

## Acceptance criteria (user-mandated, all verified)

- [x] `/api/inngest` hors proxy utilisateur ; signatures vérifiées hors dev (INNGEST_DEV=1 strict, interdit en prod ; clés requises en prod via env-guards, échec au build)
- [x] Aucune écriture privilégiée ne fait confiance au userId de l'événement (résolution `ensureUserExists` désormais interne à `startRun`)
- [x] Chaque écriture : Zod strict + contrôle de propriété explicite (`requireOwnedRun` / chemins de conflit)
- [x] Opérations privilégiées centralisées dans `agent-ops.ts` (`server-only`) — le client admin générique n'est jamais exposé aux workflows (unique importeur vérifié)
- [x] Machines à états explicites runs ET steps, appliquées dans le chemin d'écriture (transitions terminales verrouillées, CAS sur finalize avec détection de course)
- [x] Idempotence prouvée par tests déterministes : 2 déclenchements séquentiels + 2 concurrents même clé → 1 ligne `system_health_results`, 1 run, 3 steps, un seul effet logique
- [x] Replays/retries ne dupliquent pas les steps terminés (`finished_at` inchangé, steps identiques)
- [x] Échec contrôlé du mock : run `failed`, `error_code=AI_VALIDATION_FAILED`, résumé assaini (regex anti stack/secret), step `schema_valid=false`, health `ai_mock_ok=false` — aucune donnée partielle
- [x] Logs JSON avec correlationId/runId/stepName/attempt, sans secret ni payload (testé)
- [x] `/diagnostics` : DAL + client utilisateur sous RLS (runs du propriétaire uniquement) ; e2e anonyme → login
- [x] L'UI Inngest n'est jamais une preuve : toutes les assertions lisent Postgres

## Actions (files)

Created: `src/domain/run-state.ts`, `src/lib/observability/logger.ts`, `src/lib/security/errors.ts`, `src/lib/ai/mock.ts` (sonde minimale — l'abstraction complète est J5), `src/lib/db/agent-ops.ts`, `src/workflows/{client,health,health-logic,index}.ts`, `src/app/api/inngest/route.ts`, `src/app/(dashboard)/diagnostics/*` (5), `tests/unit/{run-state,observability,health-event}.test.ts`, `tests/integration/{setup,health-workflow.test}.ts`, `tests/stubs/server-only.ts`. Modified: `env-guards.ts`, `vitest.config.mts`, layout nav, `auth.spec.ts`, `package.json` (inngest:dev, verify:full), `pnpm-workspace.yaml` (protobufjs ignoré).

## Checks (evidence)

| Check                                                                                                                   | Command                 | Result                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| Gate complet (25 tests unit)                                                                                            | `pnpm verify`           | passed                                         |
| Preuves déterministes (7 tests : séquentiel, concurrent, replay, échec, user fantôme, vol de clé, machine à états step) | `pnpm test:integration` | passed                                         |
| Auth + diagnostics e2e                                                                                                  | `pnpm test:e2e`         | passed (5/5)                                   |
| RLS inchangée                                                                                                           | `pnpm test:rls`         | passed (28/28, jalon précédent, schéma intact) |

## Review findings

| Reviewer                | Severity | Finding                                                                                      | Resolution                                                                                                                                                                                                      |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| implementation-reviewer | minor    | Machine à états des steps définie mais non appliquée (code mort)                             | fixed (recordStep lit l'état courant, replay même-statut toléré, transition illégale rejetée + test intégration)                                                                                                |
| implementation-reviewer | minor    | Handler Inngest non testé (branche NonRetriable, divergence possible avec runHealthSequence) | fixed partiellement (tests du schéma d'événement + enregistrement de la fonction) ; test moteur complet **accepted** (dep @inngest/test différée — les deux compositions appellent les mêmes fonctions d'étape) |
| implementation-reviewer | minor    | Run orphelin en `running` si échec d'infra épuise les retries (pas de sweeper)               | accepted (sonde de santé : re-déclenchement reprend les steps ; sweeper noté comme travail futur)                                                                                                               |
| implementation-reviewer | info     | Référence pendante « deviation D6 » dans un commentaire                                      | fixed (reformulé)                                                                                                                                                                                               |
| security-reviewer       | minor    | Pas de limite de débit sur le chemin privilégié                                              | fixed (concurrency 2 + throttle 10/min sur la fonction)                                                                                                                                                         |
| security-reviewer       | minor    | `simulateAiFailure` honoré en production + CAS sans vérification de lignes                   | fixed (rejet NonRetriable en prod ; CAS vérifie les lignes affectées et relit le statut réel en cas de course)                                                                                                  |
| security-reviewer       | info     | isDev par Boolean() (« 0 » = vrai)                                                           | fixed (`=== "1"`)                                                                                                                                                                                               |
| security-reviewer       | info     | userId « provisionné » ≠ « émetteur » ; namespace d'idempotence global                       | accepted + documenté dans agent-ops (producteur unique = action DAL ; clés générées serveur)                                                                                                                    |

## Next action

Await user approval, then J5 (full AI abstraction + mock provider, rewiring the health probe).

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; review findings fixed or accepted with recorded rationale
