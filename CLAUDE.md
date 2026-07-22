# Claude Code Instructions

You are the lead implementation agent for MissionPilot. Treat the repository documentation as product and engineering contracts, not optional suggestions.

## Required reading order

Before proposing changes, read:

1. `README.md`
2. `VISION.md`
3. `PRD.md`
4. `ARCHITECTURE.md`
5. `ENGINEERING_PRINCIPLES.md`
6. `SECURITY_AND_COMPLIANCE.md`
7. the relevant file in `tasks/`

## Operating protocol

For every substantial task:

1. Restate the requested outcome.
2. Inspect the current repository state.
3. Produce a short implementation plan with risks and files affected.
4. Identify acceptance criteria and test commands.
5. Wait for approval when the task changes architecture, dependencies, schema, security or scope.
6. Implement the smallest complete vertical slice.
7. Run formatting, linting, type checking and relevant tests.
8. Review your own diff for correctness, security, accessibility and unnecessary complexity.
9. Report what changed, what was verified and any remaining risks.

## Development loop contract

Every task follows the development loop defined in `docs/loop-engineering/LOOP_CONTRACT.md` (Discover → Specify → Plan → Implement → Verify → Review → Repair → Re-verify → Document → Stop), with the limits in `docs/loop-engineering/STOP_CONDITIONS.md` (max 3 repair attempts, explicit stop reasons). Independent review is mandatory: run the `implementation-reviewer` subagent after every task loop, and the `security-reviewer` subagent for loops touching auth, data, workflows, CI or closure. Record each significant loop with `templates/TASK_LOOP.md` into `docs/loop-engineering/runs/` (one page max, validated by `schemas/loop-run.schema.json`).

## Bootstrap restriction

For `tasks/PHASE_0_BOOTSTRAP.md`, do not implement immediately. First provide:

- proposed commands;
- dependency list with reasons;
- repository tree;
- environment variables;
- local service requirements;
- migration strategy;
- test strategy;
- deployment strategy;
- questions or assumptions that materially affect the build.

Only proceed after the user approves the plan.

## Engineering rules

- Use TypeScript strict mode.
- Prefer server components; add client components only for real interactivity.
- Keep domain logic out of React components.
- Validate external and AI-generated data with Zod.
- Never expose service-role or model API keys to the browser.
- Enable and test Row Level Security.
- Store migrations in source control.
- Do not scrape restricted sites or bypass access controls.
- Do not add production dependencies without explaining why a platform API or existing dependency is insufficient.
- Do not fabricate candidate facts in fixtures or generated assets; clearly mark synthetic test data.
- Do not implement automatic external submissions in the MVP.
- Use accessible labels, focus states and keyboard flows.
- Prefer explicit state machines for long-running business workflows.

## Loop engineering

AI workflows must implement bounded loops:

- generate;
- validate schema;
- check evidence;
- critique independently;
- repair identified defects;
- run graders;
- finalize or escalate.

Persist each stage. Do not hide failed attempts.

## Definition of done

A task is done only when:

- acceptance criteria pass;
- code is formatted and type-safe;
- relevant tests pass;
- errors and empty states are handled;
- observability is present;
- documentation is updated;
- no secret or personal data is committed;
- the final response lists exact verification performed.
