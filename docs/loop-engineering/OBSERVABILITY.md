# Loop Observability

## What a loop record keeps

Synthetic decisions, evidence, measurements and results — **not** detailed internal reasoning, and **not** transcripts.

Each significant task loop records:

- a task identifier and goal;
- current status and attempt number (with the max);
- the actions performed and files modified;
- check results (command → passed/failed);
- reviewer findings and how each was resolved;
- the next action or the human decision required;
- the stop reason;
- start/end timestamps.

## Where

- Template: `templates/TASK_LOOP.md`.
- Contract: `schemas/loop-run.schema.json` — the canonical, machine-checkable definition of the record fields. A schema test is added during Phase 0 bootstrap (milestone J1) and wired into `pnpm test`.
- Records: `docs/loop-engineering/runs/<taskId>-<slug>.md`, **committed with the task, maximum one page each**. Phase 0 uses one record per milestone (`J0-…` to `J7-…`, defined in `README.md`).
- Records are markdown for human readability and mirror the JSON contract field-for-field (same names, same enums); when a record needs machine validation, its fields are transcribed to JSON and checked against the schema.

## What this is not

This traces the development loop only. Product runtime observability (structured logs, correlation IDs, `agent_runs`/`agent_steps`, cost per call) is specified in `ARCHITECTURE.md` and implemented in the application itself.
