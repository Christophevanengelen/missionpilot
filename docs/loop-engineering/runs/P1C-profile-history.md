# Task Loop Record — Phase 1 / PR C — Versions, history and comparison

- **schemaVersion**: 1.0
- **taskId**: P1C-profile-history
- **goal**: Read-only access to the confirmed profile versions: chronological
  list, faithful read-only version view, business-level comparison of two
  existing snapshots, and triggering the EXISTING restore contract — all
  inside the current profile experience, with the validated security,
  immutability and mutation rules untouched.
- **status**: completed
- **attempt**: 1
- **startedAt** / **completedAt**: 2026-07-23T22:00:00+02:00 / 2026-07-23T23:55:00+02:00
- **startSha**: `f393064` (main, clean and synchronized with origin)
- **branch**: `feat/phase-1-profile-history`

## Locked scope (owner arbitration)

- NO migration, NO RLS change, NO change to the SQL publish/restore
  functions, NO publish UI, NO profile redesign, NO `actions.ts` change
  unless a test demonstrates a functional defect (flagged before fixing).
- Restore keeps the EXISTING PR A contract and the UI says it honestly:
  « Cette version remplacera le contenu actuel de votre profil. Une
  nouvelle version retraçant cette restauration sera créée. Toutes les
  versions existantes seront conservées. » The `created=false` no-op case
  is shown as "no mutation happened — content already identical".
- Entry point: a single « Historique » link in the existing profile panel.
- Default comparison: previous version → latest; with a single version, no
  comparison is offered.
- Summaries shown are the deterministic `change_summary` values already
  generated at publication — no manual input.
- E2E seeds versions 1 and 2 through the existing publication contract
  (no publish UI exists); the browser journey starts at Profil → Historique.

## Diff-engine rules (owner-confirmed)

Single-valued kinds compared by `kind`; evidence compared by `evidence_id`
(embedded snapshots only — never the current mutable state); collections
without a stable id (skills, achievements) compared by canonical value:
a reworded value is honestly one `removed` + one `added` (no similarity
inference — **documented limit**). Order-only differences produce no
change. Evidence added/removed/content-changed makes the owning claim
`modified` (details attached to that entry; no separate profile entry, no
fourth category). `counts` (added · modified · removed) derive exclusively
from `entries`.

## Actions (files)

New: `src/lib/profile/version-diff.ts` (pure engine) ·
`src/app/(dashboard)/profile/history/{page,loading,error}.tsx` ·
`history/version-snapshot.tsx` (read-only snapshot rendering, server) ·
`history/compare-result.tsx` (business diff rendering, server) ·
`history/compare-picker.tsx` (local selection, client) ·
`history/restore-version.tsx` (existing restore contract, honest copy,
ref-lock + aria-busy, client) · `tests/unit/version-diff.test.ts` (12) ·
`tests/e2e/profile-history.spec.ts` (1 critical scenario, versions seeded
through the existing publication contract).
Modified: `src/lib/profile/logic.ts` (+`listVersions`,
`getVersionByNumber` — reads only) · `src/lib/copy/index.ts` (history
section FR+EN) · `profile-interview.tsx` (one « Historique » panel link) ·
`tests/integration/profile-foundation.test.ts` (+4 read/no-op contracts) ·
`src/lib/profile/actions.ts` (**flagged defect fix, owner rule honored**:
`restoreVersionAction` dropped the RPC's `created` flag, making the SQL
no-op guard indistinguishable from a real restore whenever the head number
differs from the restored number — the UI would then claim a new version
traces a restore that never happened. Demonstrated by the integration test
« restore of head-identical content reports created=false and mutates
nothing » and exercised end-to-end by e2e step 8; fix = expose the existing
`created` field in the action's return, nothing else).

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **88/88 unit** (incl. 12 version-diff) · build                                                                                                                                                                                                                                                                                                 |
| pgTAP       | **98/98** (unchanged — PR A already proves version immutability, publish/restore contracts, cross-user refusals; PR C adds no SQL)                                                                                                                                                                                                                                                        |
| integration | **19/19** (+4: list newest-first with fields · get-by-number + null · restore of head-identical content ⇒ created=false, zero mutation · cross-user reads ∅)                                                                                                                                                                                                                              |
| e2e         | **29/29** — new critical scenario green (list → read-only version → compare 1→2 with 3 coherent changes → restore with honest traceable outcome → reload persistence → versions intact → honest no-op re-restore); one transient smoke failure under parallel load in the first run, spec green in isolation and full suite green on the confirmation run (no retry added)                |
| reviews     | security **PASS** (0 finding above info) · implementation **PASS** (0 blocker/major; 4 minors repaired + 3 infos addressed, full suite re-run green 29/29 after repairs)                                                                                                                                                                                                                  |
| CI          | **green** on `c64480b` (both jobs) and again on the preview-trigger commit `1c2aa78`                                                                                                                                                                                                                                                                                                      |
| Preview     | owner-requested hosted setup done in-session (Supabase project `missionpilot` eu-west-1, GitHub integration deploy-on-main, signups disabled, 3 migrations applied; Vercel project `missionpilot`, 8 env vars — key values handled by the owner only). PR C Preview READY (Vercel Authentication protected): `missionpilot-git-fea-1ba3a5-vanengelenchristophe-6584s-projects.vercel.app` |

## Review findings

| Reviewer | Severity | Finding                                                                                                                                                                                                                                                                                                                                          | Resolution                                                                                                                                                                                                                    |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| security | —        | both auth layers hold (DAL + RLS), no IDOR (numbers and UUIDs double-scoped, SQL re-verifies auth.uid()+ownership), no markup sink, sanitized errors, no hidden change                                                                                                                                                                           | **PASS** (0 blocker/major/minor; 3 infos: unpaginated own-history list · no revalidatePath in the pre-existing restore action, compensated by navigation · e2e seeding relies on the existing state-update grant)             |
| impl     | minor ×4 | transport-level rejection in restore showed nothing (and the generic copy would have lied about an unknown outcome) · e2e step 8 double-click without intermediate assertion · integration test asserted only half of "mutates nothing" · empty version snapshot reused comparison wording                                                       | **fixed**: distinct honest `unknown` outcome («résultat incertain — rouvrez l'historique») · warning asserted between the two clicks · claims rows+states now compared before/after the no-op · dedicated `emptyVersion` copy |
| impl     | info ×7  | dead `compare.apply` copy key · overstated determinism comment on duplicate pairing · hardcoded French in loading/error/metadata (existing pattern) · no revalidation in restore action (in-scope tradeoff) · weak final e2e assertion · label-based `valueChanged` in ModifiedEntry (safe under current schemas) · duplicated `kindRank` helper | dead key removed · comment corrected (unspecified order among identical-value duplicates, accepted) · positive Version-3 assertion added before the negative · rest noted, deliberately left (scope)                          |

## Known limits

- Reworded skills/achievements appear as removed + added: the canonical
  snapshot embeds no stable claim id, and no similarity inference is done.
- Duplicate collection values with identical value but different evidence
  pair positionally; the snapshot sort leaves their relative order
  unspecified, so evidence sets may pair arbitrarily in that rare case
  (accepted simplification).
- The own-history list is unpaginated (growth is naturally bounded by the
  consecutive-difference rule; hardening candidate for later).
- `restoreVersionAction` performs no revalidatePath (pre-existing contract,
  deliberately untouched): the outcome view renders from the action result
  and every exit is a fresh dynamic navigation.

## Stop

- **requiresHumanApproval**: yes (UX validation on Vercel Preview, then
  explicit merge approval)
- **stopReason**: PR C MERGED — full journey (list → read-only version →
  compare → honest traceable restore → history intact) demonstrated live on
  the hosted Preview with a synthetic demo account before approval; owner
  explicitly approved the merge of PR #6 at head `238d737`; squash-merged
  to main as `343e2b3` (2026-07-23), branch deleted, all merge-commit
  checks green (CI both jobs · Supabase sync no-op · Vercel), production
  deployment READY on missionpilot.vercel.app. One cosmetic info noted
  during the live run: duplicated « Revenir au profil actuel » affordance
  after a successful restore (success-view button + the page's permanent
  link). Codex re-review (PR B diff + this PR) deferred to 2026-07-29
  (quota, owner decision). Hosted demo-seeding parenthesis honestly
  recorded: signups + email confirmation temporarily toggled to create the
  synthetic demo user with the PUBLIC publishable key (RLS in force, no
  secret key handled by anyone), then immediately reverted and verified.
