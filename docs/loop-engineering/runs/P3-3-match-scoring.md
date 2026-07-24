# Task Loop Record — Phase 3 / PR 3 — Deterministic match scoring + confidence

- **schemaVersion**: 1.0
- **taskId**: P3-3-match-scoring
- **goal**: Turn eligible opportunities into a **scored** view — deterministic
  component scores + an honest confidence — computed on read. Owner decision
  (recorded): **deterministic scores first, no LLM, no persistence**.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T05:50:00+02:00
- **startSha**: `78c66c3` (main, after Phase 3 PR 2)
- **branch**: `feat/phase-3-match-scoring`

## Owner decision (recorded)

Asked how to approach the matching core. Owner chose **"scores déterministes
d'abord"** + **"calcul à la lecture"**: rule-based component scores, no LLM,
no cost, no persisted table. The LLM match/critique/repair workflow is a later,
explicitly-approved slice.

## The scorer (pure, honest)

`scoreMatch(prefs, signals, facts)` → `{ overall, confidence, components[] }`.
Four components, each `0-100` or `null` (undecidable):

- **skills** (w 0.4) — share of the opportunity's demanded skills the profile's
  CONFIRMED skills cover; the matched skills are returned as **evidence**. Null
  when either side has no skills.
- **rate** (w 0.25) — offered day-rate midpoint vs the target (or, absent a
  target, the minimum), currency/period-aware; null on mismatch/no reference
  (no FX/period guessing). Capped at 100.
- **remote** (w 0.2) — `remote_type` × `remote_policy` alignment table; null
  when the policy is unset or the type is unknown/unspecified.
- **engagement** (w 0.15) — 100 if the type is preferred, else 0; null when
  unconstrained or unknown.

**HONESTY:** a `null` component is EXCLUDED from `overall` (weights renormalized
over scored components); `overall` is null if none scored. **confidence** =
share of the four components that scored → none / low / medium / high.

Signals come from `loadLivingProfile` (confirmed `skill` claims via
`profileSignalsFromClaims`). No new query shape beyond the existing living-
profile read.

## Surfacing (read-only, no migration)

- **Detail** (`[id]/page.tsx`): a "Score de correspondance" section — overall +
  confidence + per-component scores + matched-skill chips (evidence). Framed as
  **indicative, not a recommendation**. Honest empty state ("Données
  insuffisantes pour un score") when nothing is scorable.
- Copy FR+EN.

## Key safety / invariants

- Pure function; RLS owner-only reads (prefs + living profile + opportunity);
  no migration, no grants, no LLM, no fetch.
- Scores are indicative over UNVERIFIED normalized facts — no new assertion of
  truth about the opportunity.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **144/144 unit** · build                                                                                                                                                                                                                                                                            |
| unit        | **144** (+14 scorer: skills overlap+evidence, currency/period rate, remote table, engagement, null-honesty, overall renormalization, confidence thresholds, `profileSignalsFromClaims`)                                                                                                                                                        |
| integration | **33** (+1: real session + saved prefs + a CONFIRMED "Go" skill + extracted opportunity ⇒ skills score 50 with "Go" evidence, overall non-null)                                                                                                                                                                                                |
| e2e         | **33/33** — the match-score section renders on the detail page (axe-clean); honest "Données insuffisantes pour un score" with no prefs/skills                                                                                                                                                                                                  |
| reviews     | Implementation **PASS**, Security **PASS** (0 findings — own-data-only RLS, no untrusted value in a RegExp, no XSS, no migration/grant/LLM/fetch; scores can't be gamed to leak). Impl flagged **1 minor** (evidence not de-duped) + **1 nit** (EN space-before-colon), both **fixed** (below). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit (both jobs SUCCESS); re-run after the fixes.                                                                                                                                                                                                                                                                  |

## Review repairs (before merge)

- **CONFIRMED minor — skills evidence not de-duplicated.** The ratio de-duped
  the demand set but `evidence` was built from the raw `f.skills`, so `['Go',
'GO']` produced redundant chips and `['Go','Go']` collided React keys on the
  detail page. Fixed: `evidence` is de-duped by normalized token (first casing
  kept); unit test now asserts `.evidence`.
- **Nit — EN typography.** The confidence separator was hardcoded in JSX
  (`… :{" "}`), giving the French space-before-colon in English too
  ("Confidence : medium"). Fixed: the colon now lives in the per-locale label
  ("Confiance :" / "Confidence:"), so each locale gets correct punctuation.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then continue. The LLM match/critique/repair
  workflow remains a separate owner decision.
- **stopReason**: —
