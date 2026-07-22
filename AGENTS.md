# Codex Project Instructions

MissionPilot is an evidence-first, human-supervised AI opportunity intelligence platform. Read the repository documentation before modifying code.

## Mandatory context

Read in this order:

- `README.md`
- `VISION.md`
- `PRD.md`
- `ARCHITECTURE.md`
- `ENGINEERING_PRINCIPLES.md`
- `SECURITY_AND_COMPLIANCE.md`
- the active task file in `tasks/`

## Working agreement

- Begin substantial tasks in plan mode.
- Inspect existing files and scripts before proposing commands.
- State assumptions explicitly.
- Make small, reviewable changes.
- Run the narrowest relevant tests, then the full quality gate when appropriate.
- Never claim a command passed unless it was actually run successfully.
- Do not overwrite user changes unrelated to the task.
- Do not commit, push, deploy, create external resources or modify production data without explicit instruction.

## Development loop contract

Every task follows `docs/loop-engineering/LOOP_CONTRACT.md` (Discover → … → Stop) with the limits in `docs/loop-engineering/STOP_CONDITIONS.md`. Implementation work is reviewed in a separate, fresh-context pass (see `.claude/agents/`); the implementer never approves its own work. Significant loops are recorded in `docs/loop-engineering/runs/` using `templates/TASK_LOOP.md` (contract: `schemas/loop-run.schema.json`).

## Architecture constraints

- Next.js App Router and strict TypeScript.
- Supabase for initial database, auth and private file storage.
- Inngest for durable multi-step background workflows.
- Provider-neutral AI adapter layer.
- Zod schemas at all external/model boundaries.
- Deterministic policy checks before model evaluation.
- Immutable raw source snapshots and versioned analyses.
- Row Level Security from the first migration.
- Human approval before any external action.

## Product constraints

- Full-remote eligibility and freelance/B2B compatibility are first-class fields.
- Hard constraint failures cannot be hidden inside an average score.
- Unknown values remain unknown.
- Generated application claims must cite verified profile evidence.
- No restricted-site scraping or access-control circumvention.
- No autonomous application submission in the MVP.

## Quality gate

Expected commands after bootstrap, subject to the actual package scripts:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

If a command is unavailable, add or document it during Phase 0 rather than pretending it exists.

## Phase 0 rule

When asked to start, read `tasks/PHASE_0_BOOTSTRAP.md`, produce the proposed plan and wait for approval before generating the application scaffold.
