# Loop Contract

Every non-trivial task in this repository follows this loop. A task is not done because code was written; it is done when the loop has been closed with evidence.

```text
Discover → Specify → Plan → Implement → Verify → Review → Repair → Re-verify → Document → Stop
```

## Phases

1. **Discover** — read the files involved; identify constraints and dependencies. Never modify a file that has not been inspected.
2. **Specify** — before implementation, write down: goal, acceptance criteria, files likely to change, risks, checks to run, stop conditions. This becomes the task's loop record (see `templates/TASK_LOOP.md`).
3. **Plan** — order the work into the smallest coherent steps; identify failure modes.
4. **Implement** — smallest coherent change. No premature abstractions, no unrelated edits, no deviation from the documented architecture without a declared deviation.
5. **Verify** — "it works" is never proof. Run the deterministic checks that apply: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, relevant integration tests, `pnpm build`, schema validation, security checks.
6. **Review** — a **separate pass with fresh context**, performed by the read-only reviewer subagents in `.claude/agents/` (implementation-reviewer always; security-reviewer for auth/data/workflow/CI/closure tasks). The implementer must not approve its own work. Self-review (CLAUDE.md operating protocol step 8) still happens first, but it never substitutes for independent review.
7. **Repair** — fix only demonstrated findings; tie each fix to a specific finding; add a regression test when a reproducible defect is found; re-run all affected checks. Bounded by `STOP_CONDITIONS.md`.
8. **Re-verify** — repeat the applicable checks after repairs.
9. **Document** — update the docs that describe what now exists; complete the loop record.
10. **Stop** — end explicitly with a traceable `stopReason`, whether success or escalation.

## Trust order

When signals disagree, trust in this order — never accept a success claim without observable proof:

1. observable result in the environment;
2. deterministic tests and checks;
3. acceptance criteria;
4. independent review;
5. the agent's self-assessment.

## Human approval is required before

- creating an external service;
- deploying;
- spending money;
- sending an application or any message;
- destructive data changes;
- major architecture changes;
- adding a sensitive dependency;
- merging to the main branch (effective once a remote exists; during Phase 0 the equivalent gate is explicit user approval of each milestone).

## Scope note

This contract governs the **development loop**. The product's runtime AI loop is specified in `ARCHITECTURE.md` §6 and `docs/AGENT_WORKFLOWS.md`; its traces live in the `agent_runs`/`agent_steps` tables, not in `docs/loop-engineering/runs/`.
