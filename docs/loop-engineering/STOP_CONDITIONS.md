# Stop Conditions

Every loop has an explicit limit. Never start a loop or recursion without one.

## Mandatory limits (development loop defaults)

- **Maximum 3 repair attempts** per task loop. (The product's runtime repair loop is separately capped at 2 — `docs/AGENT_WORKFLOWS.md` §5; that limit is unchanged.)
- Stop if the **same error appears twice** without measurable progress.
- Stop if a pass produces **no useful change**.
- Stop if a required **piece of information, secret or external account is missing**.
- Stop **before any destructive operation or unauthorized external effect**.
- Stop when the **acceptance criteria are satisfied and verified** — do not keep polishing.

## On stopping without success

Produce a report containing:

- what was attempted;
- the evidence collected;
- the remaining errors;
- the main hypothesis;
- the human decision that is needed.

Record it in the task's loop record (`stopReason` + `reviewFindings`/`evidence`) and escalate. Do not retry silently past the limits above.

## Recording the stop

Every loop record ends with a non-empty `stopReason`, on success as well as on failure. Acceptable examples: `acceptance criteria met and verified`, `blocked: SUPABASE_SECRET_KEY unavailable`, `escalated: same typecheck error twice without progress`.
