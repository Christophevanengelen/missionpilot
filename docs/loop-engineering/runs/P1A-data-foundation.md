# Task Loop Record — Phase 1 / PR A — Profile & evidence data foundation

- **schemaVersion**: 1.0
- **taskId**: P1A-data-foundation
- **goal**: Data foundation for the versioned professional profile and evidence library — migration, RLS and minimal grants, atomic publish/restore SQL functions, domain state machine, Zod validation, DAL-verified Server Actions, and the unit/integration/pgTAP proofs. No business UI in this PR.
- **status**: completed
- **attempt**: 4 (1 build + 3 repair rounds — the repair budget's hard cap;
  a further FAIL would have stopped the loop for owner arbitration)
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
pgTAP `supabase/tests/profile_rls.test.sql` (59); domain
`src/domain/profile.ts`; `src/lib/profile/{version-content,change-summary,
logic,actions}.ts`; unit tests ×3; integration
`tests/integration/profile-foundation.test.ts`; regenerated
`src/lib/db/database.types.ts`. No UI file, no dependency, no secret.

## Checks (evidence)

| Check                                               | Result                                                                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase db reset` (both migrations apply cleanly) | passed                                                                                                                                                                                                           |
| pgTAP `pnpm test:rls`                               | **87/87** (28 phase-0 + 59 new)                                                                                                                                                                                  |
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

Both reviewers: **PASS** (0 blocker, 0 major).

**Codex pass 1 (read-only): FAIL — findings and honest resolutions:**

| Severity | Finding                                                                                 | Resolution                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blocker  | restoring a snapshot equal to the current head mutated claims with no traceable version | **fixed**: head-hash guard BEFORE any mutation — redundant restore returns `created=false`, claims untouched (+3 pgTAP)                                                                                                         |
| major    | `current_version_id` FK not same-profile constrained                                    | **fixed**: composite FK `(id, current_version_id) → profile_versions(profile_id, id)` — even privileged paths cannot cross profiles                                                                                             |
| major    | direct INSERT grant on `profile_claims` "bypasses" the actions                          | **rebutted, by design**: Server Actions execute with the caller's SESSION (`authenticated` role) — these grants ARE the actions' write path; RLS `with check` + partial unique index + chain trigger bound it; self-scoped only |
| major    | users can close their own claims without successor via PostgREST                        | **rebutted, documented**: the invoker function needs those column grants; closure-without-successor is legal domain vocabulary (restore uses it); reopening/rewriting is trigger-blocked; strictly self-scoped                  |
| minor    | evidence-change summary sensitive to array order                                        | **fixed**: order-insensitive comparison                                                                                                                                                                                         |
| minor    | `rejected → proposed` transition questioned                                             | **rebutted, intentional**: the explicit «Restaurer» action on an ignored statement (owner-approved UX); app-enforced by the state machine                                                                                       |

**Codex pass 2: FAIL (0 blocker) — resolutions:**

| Severity | Finding                                                                                                                             | Resolution                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| major    | publish trusts caller content: a user could forge their OWN immutable snapshot (e.g. an `externally_verified` badge) via direct RPC | **fixed (repair 3)**: structural honesty validation inside the function — claim kinds, object values, evidence verification/source enums enforced at the RPC boundary; forged badges refused (+2 pgTAP) |
| major    | restore materializes stored content into confirmed claims                                                                           | **mitigated by the same fix** (only validated content can be stored) + DB CHECKs on insert; residual: self-scoped only                                                                                  |
| minor    | successor could cross kinds via direct column update                                                                                | **fixed**: chain trigger now requires same profile AND same kind for both chain references (+1 pgTAP)                                                                                                   |

**Codex pass 3: FAIL** — remaining major (client-supplied snapshot content)
escalated to the owner per STOP_CONDITIONS (repair budget exhausted).

## Pass 4 — Option B (owner arbitration, new bounded repair loop)

The owner ruled **Option B**: the DATABASE is the sole author of published
content. Implemented: `publish_profile_version(profile, summary[, from])` —
the content/hash parameters are GONE; `build_profile_snapshot` (one shared
SQL canonicalization: active confirmed claims + active links + relevant
fields of confirmed evidence, stable order) and `snapshot_content_hash`
(id-stripped canonical form, sha256 via pgcrypto) run inside the locked
transaction; per-kind value schemas enforced at the DB trigger boundary
(strict keys, bounded lengths, years 0–80); all invariants preserved (lock,
idempotence, numbering, current_version_id, immutability, traceable restore,
head-equivalent refusal). The app now only WORDS the human summary
(documented accepted drift); it never supplies content.

Owner-mandated proofs (all pgTAP/integration-verified): direct RPC cannot
inject a fact absent from confirmed claims · malformed per-kind values are
refused at the boundary · the snapshot equals the confirmed DB state exactly
· **old snapshots are frozen** (a later evidence edit never rewrites them) ·
races/double submits stay serialized (one creation, consecutive numbers) ·
restore + head-equivalent refusal intact · RLS isolation unregressed ·
DEFINER-internal helpers denied to app roles (regression alarms).

Reviews (pass 4): implementation-reviewer FAIL→**repaired** (missing
frozen-evidence proof added; drift note added; both re-verified);
security-reviewer **PASS** (helpers properly sandboxed; denial proofs added
on its minor; size-guard removal accepted as self-scoped, documented).
Final counts: unit 56 · pgTAP 94 (66 new) · integration 15 · e2e 19.

**Codex pass 4 (final, read-only): recorded in the PR.**

## Stop

- **requiresHumanApproval**: yes
- **stopReason**: PR A data foundation complete — schema, RLS, atomic
  functions, domain, actions and 151 passing proofs; PR open, CI green,
  reviews recorded; awaiting owner approval before merge. PR B not started.
