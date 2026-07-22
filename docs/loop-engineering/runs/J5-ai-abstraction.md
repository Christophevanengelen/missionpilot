# Task Loop Record — J5: AI abstraction + mock provider

- **schemaVersion**: 1.0
- **taskId**: J5
- **goal**: Provider-neutral AI abstraction — envelope contract mirroring schemas/agent-output.schema.json, explicit provider allowlist, deterministic six-scenario mock — with the J4 health workflow rewired onto it without observable behavior change. Mock only: no real adapters in Phase 0 (user decision).
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (1 = implementation; 2 = review repair)
- **startedAt** / **completedAt**: 2026-07-22T20:45:00+02:00 / 2026-07-22T21:20:00+02:00

## Acceptance criteria (user-mandated, all verified)

- [x] Interface provider-neutre + mock uniquement ; **aucun** adaptateur/squelette OpenAI-Anthropic (grep vérifié — seules les variables d'env documentées subsistent)
- [x] Module IA entièrement `server-only` (envelope/mock-provider/registry ; types.ts type-only, effacé à la compilation)
- [x] Allowlist explicite, sûre contre la pollution de prototype (`hasOwnProperty`), échec propre typé (`AiConfigurationError`) pour openai/anthropic/constructor/**proto**
- [x] Aucune sortie utilisable avant validation Zod complète de l'enveloppe (parité champ-à-champ avec agent-output.schema.json confirmée par le reviewer, strictObject = additionalProperties:false)
- [x] Erreurs typées/assainies (`AiValidationError`, `AiProviderError`, `AiConfigurationError`) mappées vers step failed + run failed
- [x] Mock déterministe, 6 scénarios : succès · sortie invalide · needs_review (confiance 35) · erreur contrôlée · latence simulée (1500 ms déclarés) · contenu injecté — zéro Date.now/random, réponses identiques pour requêtes identiques (testé)
- [x] Contenu non fiable inerte : les « instructions » dans data/warnings ne changent ni schéma, ni statut, ni règles (testé) ; `mockScenario` inconnu = simple donnée
- [x] Logs sans prompt complet, donnée personnelle ni secret (codes/tâche/version/latence uniquement ; la sortie invalide brute n'est jamais loggée)
- [x] Métadonnées minimales : provider, modèle, promptVersion, latence, usage simulé, coût estimé
- [x] Workflow J4 recâblé, comportement observable inchangé : mêmes statuts, même message assaini, tests d'intégration **rejoués sans modification** (7/7)
- [x] Fake timers pour la latence (la suite n'attend jamais réellement 1,5 s)

## Actions (files)

Created: `src/lib/ai/{envelope,types,mock-provider,registry}.ts`, `tests/unit/ai-abstraction.test.ts` (10 tests). Modified: `src/lib/security/errors.ts` (+2 erreurs typées), `src/workflows/health-logic.ts` (recâblage + provider/modèle depuis la config dans les deux branches). Deleted: `src/lib/ai/mock.ts` (sonde J4, zéro référence restante).

## Checks (evidence)

| Check                                                                    | Command                 | Result       |
| ------------------------------------------------------------------------ | ----------------------- | ------------ |
| Gate complet (35 tests unit, 6 fichiers)                                 | `pnpm verify`           | passed       |
| Idempotence + échec J4 rejoués après recâblage, fichier de test inchangé | `pnpm test:integration` | passed (7/7) |
| Auth/diagnostics e2e                                                     | `pnpm test:e2e`         | passed (5/5) |

## Review findings (implementation-reviewer — PASS ; security-reviewer non requis : aucune nouvelle variable secrète, aucune frontière serveur/client modifiée)

| Severity | Finding                                                                                                          | Resolution                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| minor    | Branche d'échec : provider/modèle en littéraux ≠ configuration (piste d'audit incohérente si modèle surchargé)   | fixed (env.AI_DEFAULT_PROVIDER/MODEL)                              |
| info     | `prompt_version` désormais persisté (null en J4) — enrichissement non observable                                 | accepted (noté ici)                                                |
| info     | `tasks/PHASE_0_BOOTSTRAP.md` (« placeholder adapters ») divergent de la décision utilisateur « mock uniquement » | accepted (déviation documentée dans le README en J6)               |
| info     | Type d'enveloppe écrit à la main en parallèle du schéma Zod (risque de dérive, cast sound aujourd'hui)           | accepted (source unique à envisager quand un 2ᵉ provider arrivera) |

## Next action

Await user approval, then J6 (quality, e2e smoke + axe, CI, docs).

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; single code finding repaired, informational findings recorded
