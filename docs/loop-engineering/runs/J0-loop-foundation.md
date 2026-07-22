# Task Loop Record — J0: Loop Engineering foundation

- **schemaVersion**: 1.0
- **taskId**: J0
- **goal**: Create the minimal Loop Engineering foundation (contract docs, read-only reviewer subagents, task record template, loop-run schema, entry-doc pointers) governing all subsequent Phase 0 milestones. No runtime code, no new dependencies.
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (attempt 1 = initial implementation; attempt 2 = repairs from review)
- **startedAt** / **completedAt**: 2026-07-22T17:15:00+02:00 / 2026-07-22T17:35:00+02:00

## Acceptance criteria

- [x] 5 docs + 2 subagents + template + schema exist and describe only what exists
- [x] Schema is valid JSON Schema 2020-12 with all 16 briefing fields required
- [x] Both subagents read-only (tools: Read, Grep, Glob)
- [x] CLAUDE.md / AGENTS.md / ENGINEERING_PRINCIPLES.md / ARCHITECTURE.md carry minimal pointers
- [x] Reviewer cadence documented (impl: every milestone; security: J2/J3/J4/J6/J7)
- [x] Run-record policy documented (committed, ≤1 page, synthetic)
- [x] Stop conditions (dev max 3) + trust order reproduced; product max 2 untouched

## Actions (files)

Created: `docs/loop-engineering/{README,LOOP_CONTRACT,STOP_CONDITIONS,EVALUATIONS,OBSERVABILITY}.md`, `templates/TASK_LOOP.md`, `schemas/loop-run.schema.json`, `.claude/agents/{implementation-reviewer,security-reviewer}.md`, this record. Modified (pointers only): `CLAUDE.md`, `AGENTS.md`, `ENGINEERING_PRINCIPLES.md`, `ARCHITECTURE.md` §6.

## Checks

| Check                                                                        | Command                       | Result                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Schema parses, Draft 2020-12 valid                                           | `python3` (json + jsonschema) | passed                                                                     |
| 16 briefing fields in properties AND required                                | `python3`                     | passed                                                                     |
| stopReason non-empty enforced on terminal statuses; null allowed in_progress | `python3` (jsonschema)        | passed                                                                     |
| pnpm gates                                                                   | —                             | skipped (toolchain arrives in J1; schema test wired into `pnpm test` then) |

## Review findings

| Reviewer                | Severity | Finding                                                         | Resolution                                           |
| ----------------------- | -------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| implementation-reviewer | major    | OBSERVABILITY.md asserted nonexistent test file as current fact | fixed (future/contract framing)                      |
| implementation-reviewer | minor    | J0–J7 milestone IDs undefined in repo                           | fixed (index table added to loop-engineering README) |
| implementation-reviewer | minor    | Template lacked `schemaVersion`; md↔JSON mapping unstated       | fixed (field added; mapping rule documented)         |
| implementation-reviewer | minor    | Schema allowed null/empty `stopReason` on terminal statuses     | fixed (if/else constraint; re-verified)              |

## Next action

Await explicit user approval, then start J1 (scaffold + tooling).

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; all review findings repaired and re-verified
