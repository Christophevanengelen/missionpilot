# Task Loop Record — Phase 4 / PR 4 — Inbox filters: contract type + remote

- **schemaVersion**: 1.0
- **taskId**: P4-4-inbox-filters
- **goal**: Owner request ("Ces matchs doivent pouvoir être triés par remote,
  CDI, CDD, etc."): filter the opportunity inbox by **engagement type**
  (freelance / temps partiel / intérim / permanent) and **remote mode**
  (100 % à distance / hybride / sur site), combinable with the existing
  eligibility filter.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T13:30:00+02:00
- **startSha**: `50ada8c` (main, after Phase 4 PR 3)
- **branch**: `feat/phase-4-inbox-filters`

## Scope (read-only, no migration)

- **`opportunities/page.tsx`**: three server-rendered filter groups driven by
  plain searchParams (`filter`, `type`, `remote`), each validated against its
  closed enum (unknown values collapse to "all"). `inboxHref()` builds every
  chip link so it **preserves the other active groups** (filters combine).
  Ranking (gate → score) unchanged; filtering applies on top.
- **Copy** FR+EN: group labels + "all" chips; the option labels reuse the
  existing `engagementTypes` / `remoteTypes` copy.
- **e2e**: extended — freelance filter keeps the listing, hybrid combines
  (URL preserves `type=freelance`), onsite shows the honest empty state,
  reset chips restore; axe still clean.

## Key safety

- Untrusted searchParams validated against closed enums, used only for
  in-memory filtering and enum-built hrefs — never in a query or reflected.
  RLS owner-only; no migration, no LLM, no fetch.

## Checks (evidence)

| Check       | Result                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **169/169 unit** · build                                                                                      |
| integration | **34** (unchanged — filtering is in-memory over the same RLS-scoped reads)                                                                               |
| e2e         | **35/35** — freelance filter keeps the listing; hybrid combines (URL preserves `type=freelance`); onsite ⇒ honest empty state; resets restore; axe clean |
| reviews     | (to fill after independent passes)                                                                                                                       |
| CI          | (to fill after push)                                                                                                                                     |

## Fix found by e2e during implementation

First run failed on a **click race of my own test**: clicking a chip of the
PREVIOUS page (before the re-render) carried its stale filters along
(`?filter=excluded&type=freelance` ⇒ 0 rows) while a loose `toHaveURL`
regex still passed. Fixed by anchoring each navigation with an exact-URL
assertion before the next click — which also tightened the "hrefs preserve
other groups" coverage.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then continue (next: legal auto-discovery of
  offers feeding this same inbox).
- **stopReason**: —
