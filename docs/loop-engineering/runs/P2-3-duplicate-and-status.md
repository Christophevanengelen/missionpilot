# Task Loop Record — Phase 2 / PR 3 — Duplicate detection UX + import status/retry

- **schemaVersion**: 1.0
- **taskId**: P2-3-duplicate-and-status
- **goal**: Close the last two Phase 2 deliverables — _duplicate detection_
  and _import status and retry UX_ — by SURFACING behaviour the backend
  already implements. The `import_opportunity` RPC already returns
  `created` (false ⇒ the canonical fingerprint matched an existing
  opportunity and only a new snapshot was appended). The user was never told.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T03:10:00+02:00
- **startSha**: `6506a80` (main, after Phase 2 PR 2)
- **branch**: `feat/phase-2-duplicate-and-status`

## Context (what already exists — no re-implementation)

- **Duplicate detection is already atomic in the DB**: `import_opportunity`
  is create-or-touch by `(profile_id, canonical_fingerprint)`; on a match it
  appends an immutable snapshot, bumps `last_seen_at`, and returns
  `created: false`. Nothing about the dedup logic changes.
- The gap is purely UX: both server actions dropped `created`, and the form
  did an unconditional `router.push`, so a re-import looked identical to a
  first import.

## Scope (no migration)

- **`actions.ts`**: both `importPastedTextAction` / `importFromUrlAction`
  return `data: { opportunityId, created }` (thread the flag the RPC already
  returns — no new query).
- **`logic.ts`**: add `countSnapshots(client, opportunityId)` — a `head:true`
  count over `opportunity_snapshots` (RLS: own rows). Truthful "seen N times"
  = number of immutable snapshots (one per retrieval).
- **`import-form.tsx`**: replace the silent auto-navigation with an explicit
  import **status**:
  - `idle → submitting (aria-busy) → result | error`.
  - `result` distinguishes **created** ("Opportunité importée.") from
    **duplicate** ("Déjà importée — un nouveau snapshot a été ajouté à
    l'opportunité existante."), each with a primary link **"Voir
    l'opportunité"** and a secondary **"Importer une autre annonce"** (reset).
  - `error` keeps the pasted text and re-enables the button = **retry**;
    blocked-source reasons unchanged.
  - Rationale for dropping auto-navigation: the duplicate outcome is
    invisible if we navigate instantly. A result panel is the honest way to
    report status and is consistent with the app's inline-state convention.
- **`[id]/page.tsx`**: show **"Vue N fois"** (snapshot count) + the existing
  latest-snapshot block, so duplicate detection is visible after the fact.
- **Copy** FR+EN: `importedNew`, `importedDuplicate`, `viewOpportunity`,
  `importAnother`, `seenOnce` / `seenTimes` (singular/plural).

## Key safety / invariants (unchanged)

- Pasted text stays untrusted DATA; snapshots stay immutable; RLS owner-only.
- No migration, no new grants, no fetch. `source_url` still plain text.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **105/105 unit** · build                                                                                                                                           |
| unit        | **105** (unchanged — no pure logic added; UI status is covered by e2e, dedup/count by integration)                                                                                                            |
| integration | **30** (dedup test extended: `countSnapshots` equals the direct snapshot count = the "seen N times" source of truth)                                                                                          |
| e2e         | **33/33** — created status panel + "Voir l'opportunité" link + "Vue 1 fois"; re-import ⇒ "Déjà importée" duplicate status + "Vue 2 fois"; dedup keeps one list row; URL path updated to the result-panel flow |
| reviews     | (to fill after independent passes)                                                                                                                                                                            |
| CI          | (to fill after push)                                                                                                                                                                                          |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" —
  merge on green CI + PASS reviews, then continue. The auto-navigation → result
  panel UX change is flagged in the PR body for owner visibility.
- **stopReason**: —
