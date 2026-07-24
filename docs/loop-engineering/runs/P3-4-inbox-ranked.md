# Task Loop Record — Phase 3 / PR 4 — Score-ranked inbox

- **schemaVersion**: 1.0
- **taskId**: P3-4-inbox-ranked
- **goal**: Complete the deterministic matching loop — import → gate → score →
  **ranked inbox**. Order the inbox by the match score (PR 3) within the gate
  ordering (PR 1), and show a compact score on each row, so the best matches
  surface first.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T06:30:00+02:00
- **startSha**: `a2a65a3` (main, after Phase 3 PR 3)
- **branch**: `feat/phase-3-inbox-ranked`

## Scope (read-only, no migration)

- **`src/lib/matching/rank.ts`** (pure, unit-tested): `compareRanked` — gate is
  the primary key (eligible → review → excluded), then overall score
  descending, `null` (unscored) last. Stable: ties keep the incoming
  `last_seen_at` order.
- **`opportunities/page.tsx`**: load the living profile once, score each
  opportunity (PR 3), sort with `compareRanked`, and render a compact
  `N / 100` on each row (nothing when unscored). One extra query
  (`loadLivingProfile`) for the whole list.

## Why / what is deferred

Closes the deterministic matching experience end-to-end. The LLM match/
critique/repair workflow and evaluation fixtures remain separate slices; the
LLM one is an explicit **owner decision** (first real LLM spend + architecture).

## Key safety / invariants

- RLS owner-only reads (opportunities + prefs + living profile); no migration,
  no grants, no LLM, no fetch.
- Ranking only reorders the deterministic gate + score — no new claim about any
  opportunity; unscored rows are never ranked above scored ones dishonestly.

## Checks (evidence)

| Check       | Result                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **148/148 unit** · build                                              |
| unit        | **148** (+4 `compareRanked`: gate primary, score desc within gate, null last, stable on ties)                    |
| integration | **33** (unchanged — ranking is a pure reorder; no logic/schema touched)                                          |
| e2e         | **33/33** — inbox still renders + filters (the ranked order and per-row score are covered by the rank unit test) |
| reviews     | (to fill after independent passes)                                                                               |
| CI          | (to fill after push)                                                                                             |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. After this, present the Phase 3 milestone + the
  LLM workflow decision.
- **stopReason**: —
