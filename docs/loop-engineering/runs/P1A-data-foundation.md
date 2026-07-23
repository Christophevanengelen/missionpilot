# Task Loop Record — Phase 1 / PR A — Profile & evidence data foundation

- **schemaVersion**: 1.0
- **taskId**: P1A-data-foundation
- **goal**: Data foundation for the versioned professional profile and evidence library — migration, RLS and minimal grants, atomic publish/restore SQL functions, domain state machine, Zod validation, DAL-verified Server Actions, and the unit/integration/pgTAP proofs. No business UI in this PR.
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (1 = build; 2 = review repairs)
- **startedAt** / **completedAt**: 2026-07-23T15:30:00+02:00 / 2026-07-23T18:30:00+02:00

## Specification (owner-approved plan + mandatory corrections)

**Model.** `candidate_profiles` gains `current_version_id` (FK, no duplicated
number). `profile_claims` is the living interview state: one row per
statement, `kind` ∈ role | seniority | summary | years_experience | skill |
achievement (an _achievement_ is a business claim backed by evidence links —
no technical `achievement_ref` concept), `state` ∈
proposed | confirmed | needs_review | rejected, `origin` ∈ user | assistant.
**Corrections are modeled explicitly**: a replacement creates a new claim
carrying `previous_claim_id` and closes the old one via
`superseded_by_claim_id` + `superseded_at` — the `rejected` state is never
reused to mean "replaced". Single-valued kinds keep at most one non-superseded
claim (partial unique index). `evidence_items` is the profile's **living
library** (owner-approved deviation from DOMAIN_MODEL's `profileVersionId`),
with conversational `state`, `verification_status`
(imported | user_confirmed; externally_verified reserved and not settable by
users), and provenance (`source_type`, `source_reference`).
`claim_evidence_links` records attachments; **detachment is explicit and
traceable** (`detached_at`, `detach_reason`) — never a silent delete; one
active link per (claim, evidence) via partial unique index.

**Versions.** `profile_versions` rows are immutable snapshots:
`version_number` unique per profile, `content` = **normalized embedded
snapshot** of confirmed claims _and the relevant evidence fields_ (title,
statement, verification status, provenance) so later library edits never
rewrite an old version's meaning, `content_hash` over a canonical form that
excludes visual order, technical timestamps, meaningless ids and UI metadata,
`change_summary` in plain French, `created_from_version_id` for restores.
**No global UNIQUE(profile_id, content_hash)** — only _consecutive_ versions
must differ, so an old content can be restored later.

**Atomicity.** Publication and restoration run inside single SQL functions
(`security definer`, `set search_path = ''`, `auth.uid()` ownership check
inside, execute revoked from public/anon, granted only to authenticated):
lock the profile row FOR UPDATE → read last version → compare hash (same →
return existing, `created=false`) → next number → insert version → update
`current_version_id`, all in one transaction. `restore_profile_version`
additionally supersedes active claims and rebuilds them from the snapshot,
then delegates to the publish path. A small `security invoker` function
(`replace_profile_claim`) makes supersede+insert atomic under the caller's
own RLS.

**Immutability vs erasure.** No user UPDATE/DELETE anywhere on versions
(grants: authenticated SELECT only; INSERT only via the definer function; no
UPDATE for any role). A controlled erasure path stays possible for the future
privacy workflow: `service_role` retains DELETE (documented; no absolute
trigger that would block account deletion).

**Writes.** Interactive user data goes through DAL-verified Server Actions
(`verifySession()` + Zod) using the request-scoped session client — RLS owner
policies (`with check` incl. profile-ownership join) are the second barrier.
`service_role`/agent-ops is NOT used for this vertical.

## Acceptance criteria

- [x] Migration applies cleanly on `db reset`; types regenerated.
- [x] pgTAP: anon zero access on the 4 tables; A/B isolation on read AND
      write; version rows immune to authenticated UPDATE/DELETE and to direct
      INSERT; publish/restore functions refuse anon and non-owners;
      consecutive-duplicate publish returns the existing version (no row);
      version numbers strictly monotonic; single-active-claim and
      single-active-link partial indexes enforced; `externally_verified` not
      settable by users.
- [x] Unit: claim state machine (legal/illegal transitions), canonical
      content + hash (reference vectors, order-insensitivity), French change
      summary (reference cases incl. no-change).
- [x] Integration (local stack): publish idempotence under double submit;
      two concurrent different publishes serialize into n+1, n+2; restore
      rebuilds claims + links and creates a traceable new version;
      replace_profile_claim is atomic and owner-scoped.
- [x] No business UI; no new dependency; no secret; deviations documented.

## Actions (files)

Migration `supabase/migrations/20260723115606_phase1_profile_evidence.sql`
(4 tables, chain-integrity trigger, 3 SQL functions, RLS + minimal grants);
pgTAP `supabase/tests/profile_rls.test.sql` (53); domain
`src/domain/profile.ts`; `src/lib/profile/{version-content,change-summary,
logic,actions}.ts`; unit tests ×3; integration
`tests/integration/profile-foundation.test.ts`; regenerated
`src/lib/db/database.types.ts`. No UI file, no dependency, no secret.

## Checks (evidence)

| Check                                               | Result                                                                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase db reset` (both migrations apply cleanly) | passed                                                                                                                                                                                                           |
| pgTAP `pnpm test:rls`                               | **81/81** (28 phase-0 + 53 new)                                                                                                                                                                                  |
| Unit `pnpm test`                                    | **56/56** (21 new: state machine, canonicalization/hash incl. total-order determinism, FR summaries)                                                                                                             |
| Integration `pnpm test:integration`                 | **14/14** (correction chain, illegal transition, idempotent double submit, SAME-content race → 1 row, DIFFERENT-content race → n+1/n+2, restore with links + traceability, cross-user lockout via real sessions) |
| `pnpm verify:full`                                  | fully green (see PR)                                                                                                                                                                                             |

## Review findings

| Reviewer | Severity | Finding                                                                             | Resolution                                                                                                                                                                     |
| -------- | -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| impl     | minor    | evidence comparator lacked an equal branch → hash-determinism hole                  | fixed (total order over full embedded record) + unit test                                                                                                                      |
| impl     | minor    | concurrency test didn't prove different-content n+1/n+2; contradictory comments     | fixed (two tests: same-content race → 1 row; different-content race → consecutive numbers)                                                                                     |
| impl     | minor    | claim state machine app-layer only                                                  | partially DB-hardened (chain-integrity trigger: same-profile refs, no reopening, no successor rewrite) + **documented decision**: state-transition legality stays app-enforced |
| impl     | info     | summary said "aucun changement" on evidence-content edits                           | fixed ("Preuves rattachées mises à jour.") + test                                                                                                                              |
| impl     | info     | restore closes in-progress proposals                                                | documented semantics (revert living state to snapshot)                                                                                                                         |
| impl     | info     | non-owner pgTAP test used an RLS-nulled subquery                                    | fixed (real foreign ids via set_config)                                                                                                                                        |
| security | minor    | explicit supersede target not validated (cross-profile chain ref + claim-id oracle) | fixed in SQL (same profile + same kind + active, else raise) + pgTAP                                                                                                           |
| security | minor    | chain/lifecycle columns user-writable via PostgREST                                 | chain-integrity trigger added; `origin` stays user-settable (both origins describe the user's own interview — documented)                                                      |
| security | info     | content hash not recomputed in DB; content size unbounded                           | size guard added (256 KB); hash **advisory at rest** by design (computed app-side, tested canonicalization; self-scoped) — documented                                          |
| security | info     | crafted stored content can fail one's own restore                                   | accepted (atomic rollback proven; self-DoS only)                                                                                                                               |

Both reviewers: **PASS** (0 blocker, 0 major). Codex verdict recorded in the PR.

## Stop

- **requiresHumanApproval**: yes
- **stopReason**: PR A data foundation complete — schema, RLS, atomic
  functions, domain, actions and 151 passing proofs; PR open, CI green,
  reviews recorded; awaiting owner approval before merge. PR B not started.
