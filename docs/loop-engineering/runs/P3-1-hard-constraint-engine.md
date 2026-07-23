# Task Loop Record — Phase 3 / PR 1 — Deterministic hard-constraint engine

- **schemaVersion**: 1.0
- **taskId**: P3-1-hard-constraint-engine
- **goal**: The first slice of Phase 3 (matching). A pure, deterministic
  engine that gates each imported opportunity against the profile's LIVE hard
  constraints (P1 PR E), producing an honest eligibility verdict with reasons.
  No LLM, no scoring yet — this is the deterministic floor every later scoring
  layer sits on.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T04:00:00+02:00
- **startSha**: `19fc77a` (main, after Phase 2)
- **branch**: `feat/phase-3-hard-constraint-engine`

## Why this slice, and what it deliberately is NOT

Phase 3 deliverables: hard-constraint engine · evidence retrieval · match/
critique/repair workflow · component scores + confidence · evaluation
fixtures · opportunity inbox + detail. This PR ships ONLY the **hard-constraint
engine** because it is deterministic, depends only on data already in
production (profile constraints + normalized opportunity fields), and gates
everything the later (LLM-backed) scoring layers do.

**Deliberately deferred (not decided here):** persistence of match results
(a `matches`/evaluations table), the Inngest match/critique/repair workflow,
component scores/confidence, and any real LLM call. This PR computes the
verdict **on read** (cheap, always fresh, like `computeUnknowns`). If a later
slice needs to persist scores, that schema is designed then — this PR does not
commit the matching architecture.

## The engine (pure, honest)

`evaluateHardConstraints(prefs: ProfilePreferences, facts: OpportunityFacts)`
→ `{ gate, checks[] }`. Each check verdict is one of:

- `pass` — the constraint is satisfied by KNOWN data;
- `violated` — KNOWN data breaks a hard rule;
- `unknown` — the opportunity lacks the data to decide (honest: never a false
  pass or false violation);
- `not_constrained` — the user set no such hard constraint.

Constraints assessed (only those decidable deterministically from normalized
fields; soft preferences — target rate, role families, languages, timezone,
travel — are scoring-layer concerns, not hard gates here):

1. **remote_only policy** — only `remote_policy = 'remote_only'` is a hard
   gate. opp `onsite`/`hybrid` ⇒ violated; `remote_only` ⇒ pass; `unspecified`
   /null ⇒ unknown. Other policies (`remote_first`/`hybrid`/`onsite_ok`/null)
   ⇒ not_constrained (soft).
2. **preferred engagement types** — non-empty list is a hard gate. opp type in
   list ⇒ pass; known and not in list ⇒ violated; null ⇒ unknown; empty list
   ⇒ not_constrained.
3. **minimum day rate** — hard floor, currency/period-aware. Comparable only
   when opp period = `day` and opp currency = `base_currency`. Then: best-case
   offered (max ?? min) < floor ⇒ violated; worst-case (min ?? max) ≥ floor ⇒
   pass; range straddles floor ⇒ unknown. Missing floor/currency/comp, period
   ≠ day, or currency mismatch ⇒ unknown (no FX/period assumptions — honest).
4. **hard exclusions** — keyword blocklist. Any exclusion term matched (case-
   insensitive, word-boundary, on title+org+description+skills+requirements+
   responsibilities+location) ⇒ violated (names the term); empty list ⇒
   not_constrained; else pass. Word-boundary matching avoids `java`⇒`javascript`
   false positives (a violation EXCLUDES, so precision matters).
5. **allowed work regions** — a region string appearing (case-insensitive) in
   the opp location ⇒ pass; location present but no match ⇒ unknown (free text
   cannot PROVE the location is outside a region — never a false violation);
   location null ⇒ unknown; empty list ⇒ not_constrained. (Region reasoning is
   improved by the later LLM slice.)

**Gate aggregation:** any `violated` ⇒ `excluded`; else any `unknown` ⇒
`review`; else ⇒ `eligible`.

## Surfacing (read-only, no migration)

- **List**: a compact gate badge per opportunity (Éligible / À vérifier /
  Exclu). `listOpportunities` select extended with the fields the engine reads.
- **Detail** (`[id]/page.tsx`): a "Contraintes dures" section — the overall
  gate + each assessed check with its verdict and a short reason. Framed as a
  deterministic pre-filter, NOT a recommendation (that comes with scoring).
- Copy FR+EN for gate + check labels + verdicts.

## Key safety / invariants

- Pure function, no I/O; unknowns are honest (no guessed pass/violation).
- Reads the profile's LIVE constraints (loadPreferences) + normalized fields;
  RLS owner-only throughout. No new grants, no migration, no LLM, no fetch.
- Normalized fields remain UNVERIFIED assertions — the engine gates, it does
  not assert the opportunity's facts are true.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **130/130 unit** · build                                                                                                                                                                                                                                                   |
| unit        | **130** (+25 engine: each constraint × pass/violated/unknown/not_constrained, currency/period-aware rate incl. honest one-sided ranges, word-boundary exclusions & regions, gate aggregation, row adapter)                                                                                                            |
| integration | **32** (+2: through a real session + saved prefs + real extraction — a casino/onsite/low-rate listing ⇒ `excluded` with the named term; a clean remote listing ⇒ not excluded)                                                                                                                                        |
| e2e         | **33/33** — the deterministic gate renders on the detail page ("Contraintes dures" region, "Éligible" with no prefs); banner assertion scoped to the note landmark                                                                                                                                                    |
| reviews     | Implementation **PASS**, Security **PASS** (0 findings — own-data-only RLS, no untrusted value compiled into a RegExp, no ReDoS/XSS, no migration/grant/LLM/fetch). Impl flagged **2 minor honesty edges**, both adversarially **CONFIRMED** and **repaired** (below). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit (Quality gates + Database/e2e gates SUCCESS); re-run after the honesty repairs.                                                                                                                                                                                                      |

## Review repairs (before merge) — both uphold the honesty rule

- **CONFIRMED minor — region substring false `pass`.** `checkRegions` used
  `location.includes(region)`, so `"Kyiv, Ukraine"` matched `["UK"]` and
  `"Toulouse, France"` matched `["US"]` → a false `pass` that could flip the
  gate from the honest `review` to `eligible`. Fixed: reuse the Unicode
  word-boundary `matchesTerm` helper. Regression test added.
- **CONFIRMED minor (latent) — single-sided rate collapse.** `hi = max ?? min`
  / `lo = min ?? max` collapsed a genuinely one-sided range to a point: a
  min-only range below the floor returned `violated` (false EXCLUSION), a
  max-only range above the floor returned `pass`. Not reachable from today's
  extractor (single figures become min=max) but a live gap for the future LLM
  extractor. Fixed: treat the unstated side as unbounded → `unknown` unless the
  KNOWN side alone settles it. Test updated accordingly.

## Note — accessibility fix during implementation

The first gate-badge styling used `text-success` on `bg-success/10`, which axe
flagged at 4.04:1 (< AA 4.5:1). Fixed by carrying meaning through the tint +
border + **text label** and keeping the text `text-foreground` (the app's
existing accessible pattern for the review badge / unverified banner) — never
color alone.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then continue. The compute-on-read choice (vs a
  persisted matches table) is flagged in the PR body for owner visibility.
- **stopReason**: —
