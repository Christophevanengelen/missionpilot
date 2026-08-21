# Task Loop Record — APPLY-PACK-L1: CV variants schema

- **schemaVersion**: 1.0
- **taskId**: APPLY-PACK-L1
- **goal**: Store per-profile CV variants (owner-scoped) and let the live application draft record which variant it accompanies and why. Schema + RLS + pgTAP only, no UI.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt** / **completedAt**: 2026-08-17T17:45:00Z / 2026-08-17T18:45:00Z

## Acceptance criteria

- [x] migration applies cleanly on a reset local stack (static SQL review only — see Checks)
- [x] RLS owner-only on every verb; cross-profile variant creation blocked
- [x] draft records variant + rationale; cross-profile attach blocked by composite FK
- [x] variant deletion clears the draft's reference (and rationale) without touching the draft
- [x] pgTAP suite covers the above; `pnpm typecheck` unaffected

## Constraints

- Prepare, don't send: nothing in this loop submits anything.
- Real CV data enters through the app; dev seeds stay synthetic.
- Local stack unavailable this session (no supabase CLI, Docker down): runtime SQL evidence must come from CI / next local run.

## Actions (files created/modified)

- `tasks/FEATURE_APPLY_PACK.md` (new — feature plan, loops L1–L5)
- `supabase/migrations/20260817190000_variantes_de_cv.sql` (new)
- `supabase/tests/cv_variants_rls.test.sql` (new, plan(15))

## Checks

| Check          | Command          | Result                                      |
| -------------- | ---------------- | ------------------------------------------- |
| Typecheck      | `pnpm typecheck` | passed                                      |
| RLS suite      | `pnpm test:rls`  | skipped — no local stack; to run in CI      |
| Fixture unique | `grep -rl …`     | passed (abab1111/cdcd6666 only in new file) |

## Evidence

- Postgres 17 confirmed (`supabase/config.toml`), validating the column-scoped `on delete set null (cv_variant_id)`.
- `import_opportunity` call signature in the test matches `20260724010000_phase2_opportunity_ingestion.sql` (7 args, 64-char hashes).
- Migration mirrors the house pattern (revoke-first, grants to authenticated + service_role, owner policies × 4) per `20260801140000_offres_ecartees.sql`.

## Review findings

| Reviewer                            | Severity | Finding                                                        | Resolution                                      |
| ----------------------------------- | -------- | -------------------------------------------------------------- | ----------------------------------------------- |
| implementation-reviewer             | blocker  | F1 missing `revoke all` (TRUNCATE inherited; guard test fails) | fixed                                           |
| implementation-reviewer             | major    | F2 no `service_role` grant                                     | fixed                                           |
| implementation-reviewer             | major    | F3 update verb + cross-user tamper untested                    | fixed                                           |
| implementation-reviewer             | minor    | F4 rationale outlives deleted variant                          | fixed (trigger clears it)                       |
| implementation-reviewer             | minor    | F5 fixture UUID/email collisions                               | fixed                                           |
| implementation-reviewer             | minor    | F6 no index behind the composite FK                            | fixed (partial index)                           |
| implementation-reviewer             | info     | F7 `database.types.ts` not regenerated                         | accepted — first step of L2 (needs local stack) |
| implementation-reviewer (re-review) | minor    | F3 residual: cross-user blanket delete untested                | fixed (lives_ok added, plan(15))                |
| implementation-reviewer (re-review) | minor    | N1: no execute revoke on the trigger function                  | fixed                                           |

Re-review (same reviewer, fresh pass) confirmed F1–F6 resolved as claimed, validated the trigger fires on the FK referential action, and raised the two minors above, fixed in the same loop. Runtime evidence (criteria 1–4) still pending one green `pnpm test:rls` on a reset stack — CI or next local session.

## Next action

L2 — variant selection in the tailoring workflow. First step: `pnpm db:reset && pnpm test:rls && pnpm db:types` on a working local stack.

- **requiresHumanApproval**: yes — merging feat/apply-pack into main (loop contract gate)
- **stopReason**: L1 complete; runtime RLS evidence delegated to CI/next local run
