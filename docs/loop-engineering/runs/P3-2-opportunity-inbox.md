# Task Loop Record — Phase 3 / PR 2 — Opportunity inbox (gate triage)

- **schemaVersion**: 1.0
- **taskId**: P3-2-opportunity-inbox
- **goal**: Turn the opportunity list into a triage **inbox** using the
  deterministic hard-constraint gate (PR 1): the user sees what clears their
  hard constraints first, what needs a manual check next, and what is excluded
  last — and can filter by eligibility. No LLM, no migration.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T05:10:00+02:00
- **startSha**: `4a771cf` (main, after Phase 3 PR 1)
- **branch**: `feat/phase-3-opportunity-inbox`

## Scope (read-only, no migration)

- **`opportunities/page.tsx`**: evaluate the gate for each owned opportunity
  (reusing PR 1), then:
  - **order** by triage priority: `eligible` → `review` → `excluded` (stable
    within a bucket, preserving the `last_seen_at` order);
  - **counts** per gate rendered as filter chips (`Tout (n)`, `Éligible (n)`,
    `À vérifier (n)`, `Exclu (n)`);
  - a **filter** driven by a plain `?filter=eligible|review|excluded`
    searchParam — server-rendered, **no client JS**; an unknown value falls
    back to "all";
  - excluded rows are visually de-emphasized (`opacity-70`).
- **Accessibility**: the filter is a `<nav aria-label>` of links; the active
  chip carries `aria-current="page"` and a high-contrast active style.
- Copy FR+EN (`inbox.all`, `inbox.empty`, `inbox.filterLabel`).

## Why now / what is deferred

The "opportunity inbox" is a named Phase 3 deliverable and builds directly on
the deterministic gate without needing any new data. The **match/critique/
repair workflow** (first real LLM usage + persisted match results + cost +
model choice) is the next slice and is a **genuine owner decision** — it is NOT
started here.

## Key safety / invariants

- Still RLS owner-only; no migration, no grants, no LLM, no fetch.
- The gate is the deterministic PR 1 verdict — the inbox only orders/filters by
  it; it makes no new claim about an opportunity.

## Checks (evidence)

| Check       | Result                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **130/130 unit** · build                                                              |
| unit        | **130** (unchanged — the triage is thin UI/searchParam logic over the PR 1 engine; behaviour covered by e2e)                     |
| integration | **32** (unchanged — no logic/schema touched; the inbox reads the same RLS-scoped data)                                           |
| e2e         | **33/33** — filter nav present + accessible (axe-clean on the inbox surface); "Exclu (0)" ⇒ empty state; "Tout" restores the row |
| reviews     | (to fill after independent passes)                                                                                               |
| CI          | (to fill after push)                                                                                                             |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then continue. The LLM matching workflow that
  follows will be escalated as an owner decision.
- **stopReason**: —
