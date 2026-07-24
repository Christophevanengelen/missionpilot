# Task Loop Record — Ops / 1 — Hosted-migration CI

- **schemaVersion**: 1.0
- **taskId**: OPS-1-hosted-migration-ci
- **goal**: Close the deploy gap the owner hit ("nothing changes on the
  preview"): committed migrations were never applied to the HOSTED Supabase
  database (no automation existed; the README made it a manual step). Add a
  workflow that applies them — automatically on merge and on demand — so the
  hosted DB tracks the code.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T07:30:00+02:00
- **startSha**: `15f8b19` (main, after Phase 3 PR 4)
- **branch**: `feat/ci-hosted-migrations`

## Context / root cause

The production Vercel deploy is `READY` on the latest `main`, but the hosted
Supabase project only had (at most) the Phase 0 schema: nothing pushed the
Phase 1/2/3 migrations. So the authenticated pages (`/opportunities`, profile)
would 500 on missing tables/columns — the owner sees "nothing changed".

## Scope

- **`.github/workflows/deploy-migrations.yml`** — `supabase db push` to the
  hosted project. Triggers: `push` to `main` on `supabase/migrations/**` +
  `workflow_dispatch`. Mirrors `ci.yml` (SHA-pinned actions, `pnpm exec
supabase` for version parity, `permissions: contents: read`).
- **Graceful skip**: a guard step marks the job green-but-skipped until
  `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` secrets exist — no scary red
  X before the owner arms it.
- **README**: the hosted-migration step now documents this workflow + the two
  secrets + the one-time manual run for the backlog.

## Key safety

- Consumes secrets ONLY here (CI stays secret-free). Triggers are
  push-to-main + manual dispatch — **never `pull_request`** — so a fork PR can
  never reach the secrets. Secrets flow through `env:` only, never echoed.
- The workflow is INERT until the owner adds the secrets. It does not run on
  this PR's merge (no migration file changes here).

## What the owner still must do (I cannot)

- Add the two repository secrets (I must not handle secrets in plaintext, and I
  do not have them).
- Trigger the workflow once (Run workflow) to apply the Phase 1/2/3 backlog to
  production — mutating the prod DB is an owner action.

## Checks (evidence)

| Check   | Result                                                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify  | passed — format:check · lint · typecheck · **148/148 unit** · build                                                                                                                                                        |
| reviews | Implementation **PASS**, Security **PASS** — 0 confirmed defects (verified: `db push` won't hang in non-TTY CI; guard-skip stays green; triggers never expose secrets to fork PRs). 2 hardening items **applied** (below). |
| CI      | Quality gates + Database/e2e gates SUCCESS on the first pushed commit; re-run after the hardening.                                                                                                                         |

## Hardening applied (from review)

- **Secret exposure surface (minor).** The two secrets were job-level `env`, so
  present during `pnpm install` lifecycle scripts. Scoped them to only the
  `guard`/`link`/`push` steps (step-level `env`); `install` no longer sees them.
- **`timeout-minutes: 15`.** A hung `db push` can no longer hold the concurrency
  slot for the 6h default.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Arming the workflow (secrets + first run) is the
  owner's, and is flagged clearly.
- **stopReason**: —
