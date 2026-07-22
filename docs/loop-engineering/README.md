# Loop Engineering

MissionPilot is built with loops, not one-shot prompts. This folder defines the **development loop**: how coding agents (Claude Code, Codex) and humans execute every task in this repository.

## Two loops — do not confuse them

|                     | Development loop (this folder)                                  | Product loop                                                                    |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| What runs           | Coding agents working on tasks/milestones                       | MissionPilot's AI workflows in production                                       |
| Defined by          | `LOOP_CONTRACT.md`, `STOP_CONDITIONS.md`                        | `ARCHITECTURE.md` §6, `docs/AGENT_WORKFLOWS.md`, `docs/EVALUATION_FRAMEWORK.md` |
| Trace format        | `schemas/loop-run.schema.json` → one record per task in `runs/` | `agent_runs` / `agent_steps` database tables                                    |
| Max repair attempts | 3 (see `STOP_CONDITIONS.md`)                                    | 2 (see `docs/AGENT_WORKFLOWS.md` §5)                                            |

The two limits differ on purpose; neither document overrides the other.

## Index

- [`LOOP_CONTRACT.md`](LOOP_CONTRACT.md) — the loop phases, the trust order, review rules.
- [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md) — mandatory limits and the failure-report format.
- [`EVALUATIONS.md`](EVALUATIONS.md) — outcome-oriented evaluations for future product phases.
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — what a loop record keeps, and where.
- [`runs/`](runs/) — one committed record per completed task loop (max one page each).
- [`../../templates/TASK_LOOP.md`](../../templates/TASK_LOOP.md) — the record template.
- [`../../schemas/loop-run.schema.json`](../../schemas/loop-run.schema.json) — the record contract.

## Phase 0 milestones

Phase 0 (`tasks/PHASE_0_BOOTSTRAP.md`) is executed as eight task loops. This is the authoritative index for the `J<n>` identifiers used across this folder:

| ID  | Scope                                     | Touches auth/data/workflows/CI/closure? |
| --- | ----------------------------------------- | --------------------------------------- |
| J0  | Loop Engineering foundation (this folder) | no                                      |
| J1  | Next.js scaffold + quality tooling        | no                                      |
| J2  | Supabase local + authentication           | **yes** (auth)                          |
| J3  | Initial schema + RLS + pgTAP              | **yes** (data)                          |
| J4  | Inngest "system health" workflow          | **yes** (workflows)                     |
| J5  | AI abstraction + mock provider            | no                                      |
| J6  | Quality, e2e smoke, CI, docs              | **yes** (CI)                            |
| J7  | Closure: full gate, git init, dry run     | **yes** (closure)                       |

## Reviewers

Two read-only subagents are defined in `.claude/agents/`:

- **implementation-reviewer** — runs after **every** milestone/task loop.
- **security-reviewer** — runs only for loops touching authentication, data, workflows, CI or release closure (Phase 0: milestones J2, J3, J4, J6, J7).

The implementer never approves its own work. Reviewer findings feed the Repair phase; unresolved blocker findings prevent the loop from completing.
