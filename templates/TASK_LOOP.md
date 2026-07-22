# Task Loop Record — <taskId>: <title>

> Copy to `docs/loop-engineering/runs/<taskId>-<slug>.md`. Keep it to one page: decisions, evidence, measurements — no transcripts, no internal reasoning. Contract: `schemas/loop-run.schema.json`.

- **schemaVersion**: 1.0
- **taskId**:
- **goal**:
- **status**: in_progress | completed | failed | escalated
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt** / **completedAt**: <ISO 8601>

## Acceptance criteria

- [ ] …

## Constraints

- …

## Actions (files created/modified)

- …

## Checks

| Check | Command  | Result                    |
| ----- | -------- | ------------------------- |
| …     | `pnpm …` | passed / failed / skipped |

## Evidence

- …

## Review findings

| Reviewer                | Severity | Finding | Resolution                   |
| ----------------------- | -------- | ------- | ---------------------------- |
| implementation-reviewer | …        | …       | fixed / accepted / escalated |

## Next action

…

- **requiresHumanApproval**: yes | no
- **stopReason**: …
