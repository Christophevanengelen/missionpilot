# Outcome-Oriented Evaluations

`docs/EVALUATION_FRAMEWORK.md` defines the evaluation layers (deterministic validation, fixtures, model graders, human feedback). This page adds the **outcome orientation**: future evaluations must measure the real result, not the plausibility of the output.

## What future product evaluations must verify

For opportunity ingestion and matching (Phases 2-3):

- the opportunity actually exists;
- its source is recorded (URL, retrieval date, snapshot);
- it is not a duplicate of an already-known record;
- its posting date is recent enough to be actionable;
- geographic restrictions are identified, not glossed over;
- the "remote" claim is verified against the listing's own evidence;
- every material claim links to profile or listing evidence;
- the match score is explainable component by component;
- no application is ever sent without explicit human validation.

## Status

Nothing in this list is implemented in Phase 0 — Phase 0 only proves the trace plumbing (`agent_runs`, `agent_steps`, schema-validated mock output). Each item above becomes a fixture or deterministic check in the phase that implements the corresponding feature, following the thresholds already set in `docs/EVALUATION_FRAMEWORK.md`.
