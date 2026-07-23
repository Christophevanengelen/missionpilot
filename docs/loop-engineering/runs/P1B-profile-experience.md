# Task Loop Record — Phase 1 / PR B — Guided profile interview experience

- **schemaVersion**: 1.0
- **taskId**: P1B-profile-experience
- **goal**: The first genuinely usable business vertical: an authenticated,
  deterministic, guided professional interview at `/profile` that turns
  conversation into the PR A foundation's structured, verifiable claims and
  evidence — premium Studio-calme UX, French-first, honest at every level.
- **status**: completed
- **attempt**: 5 (1 = build; 2 = Claude review repairs; 3 = Codex repairs ×2
  — budget cap; 4 = owner-authorized bounded repair, honest `paused` terminal;
  5 = owner-authorized CI diagnosis + bounded product repairs — see below)
- **startedAt** / **completedAt**: 2026-07-23T15:00:00+02:00 / 2026-07-23T21:30:00+02:00

## Attempt 5 — CI red root causes and owner-authorized repairs

The GitHub CI e2e stayed red after attempt 4. Owner forbade reload fallbacks,
retry inflation and waiting for quota; authorized bounded diagnosis + product
repair passes instead. Root causes found and fixed (each proven locally):

1. **Revalidation separation** — `revalidatePath` runs in its own try/catch
   (`revalidateProfile`): a revalidation exception can never report a
   COMMITTED mutation as `ok:false`; structured log (action, step, mutation:
   committed, errorType, reason) + diagnostic `revalidated` flag. The full
   server output is teed to `playwright-webserver.log` and uploaded as a CI
   artifact (`if: always()`), which proved zero server-side action failures.
2. **Action-returned canonical snapshot** — every mutation re-reads the
   living state post-commit and returns it; the client renders from the
   action's own return (`setLiving(result.snapshot)`), never from an RSC
   patch commit. Props only seed at mount; no `router.refresh`, no optimistic
   state. A post-commit read failure is itself isolated: the action still
   returns `ok:true` with the snapshot omitted (never a dishonest failure).
3. **Dead-click root cause** — a native `disabled` attribute landing in a
   re-render between hit-test and dispatch swallows the click (reproduced
   10/10 under 4x CPU throttle via `E2E_CPU_THROTTLE`, env-gated, off in CI).
   Fix: `aria-busy` + `pointer-events-none` + the synchronous ref lock on ALL
   mutation controls; extra clicks are dropped before any server call.
4. **Mobile shell (owner Option A)** — below `sm` the dashboard nav becomes a
   compact horizontal bar above the content (desktop `sm:` column unchanged);
   chips, attach-button and evidence-form fields made wrappable/`min-w-0`,
   dates stacked on mobile. Owner rule: **320 px is no longer blocking for
   the MVP** — the viewport e2e checks 390 px and 414 px once.
5. **Test robustness (no retries added)** — expect timeout 15 s, settle
   helper (visible lead + double rAF), role-scoped selectors, dedicated
   synthetic users per run.

## Owner arbitrations honored

Foundation = 6 elements (role, seniority, years, summary, ≥1 skill, ≥1
achievement confirmed) · Ignorer → `rejected`, engine moves on, explicit
«Restaurer» on the card/panel · thread = compact PROJECTION of business state
(no persisted chat log; never pretends to be a transcript) · progression =
« Socle du profil : X éléments sur 6 » with an accessible segmented bar (no
fake percentage) · nav renamed « Profil & Preuves » · shared components got
optional callbacks only (UX Preview functionally unchanged, still the visual
reference).

**Mandatory product corrections:** first question is « Quel rôle
professionnel voulez-vous présenter en priorité ? » (profile-centric, never
mission preferences) · `role_played` is an explicit `evidence_items` column
(owner-authorized minimal migration: SQL CHECK 200 = Zod cap, column-scoped
grant, embedded + frozen in the canonical snapshot, pgTAP-proven — no other
model change) · exact action semantics implemented AND traced: Confirmer
proposed→confirmed · Ignorer proposed/needs_review→rejected · Restaurer
rejected→proposed then human re-confirmation · Corriger asks a new
formulation and REPLACES via the supersede chain · **Approfondir is real**:
needs_review + kind-specific deterministic follow-up question + replacement
proposal to confirm · «appuyé par une preuve» only when confirmed claim +
active link + confirmed evidence, with the verification level shown
separately («déclarée par vous» — user evidence can never appear externally
verified).

## Actions (files)

Engine: `src/lib/profile/interview.ts` (pure deterministic next-step, honest
support tier, verbatim answer parsing) + `interview-projection.ts` (compact
narrative + panel facts). Route: `(dashboard)/profile/{page,profile-interview,
loading,error}.tsx`. Migration: `20260723134703_phase1b_role_played.sql`.
Extensions (optional props only): Thread `renderCard`/`onChip`, Composer
`onSend`, ContextSummary `foundation` segments + supported badge,
`conversation-types` (ThreadState moved, KnownFact.supported). New card:
`evidence-form-card.tsx`. Copy: interview FR+EN. Nav: « Profil & Preuves ».
Attempt 5 files: `src/lib/profile/actions.ts` (revalidation separation +
canonical snapshot protocol + isolated post-commit read) ·
`profile-interview.tsx` (authoritative living state, aria-busy busyProps,
per-sub-action snapshots) · `(dashboard)/layout.tsx` (mobile nav Option A) ·
`composer.tsx` / `thread.tsx` / `evidence-form-card.tsx` (wrap + min-w-0) ·
`playwright.config.ts` + `.github/workflows/ci.yml` (webserver-log artifact).
Tests: `tests/unit/interview-engine.test.ts` (20) ·
`tests/e2e/profile-interview.spec.ts` (9, serial) · pgTAP +2 (plan 70) · fixtures.

## Checks (evidence)

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (76 unit) + build | passed                                                                                                                                                                                                                                                                                                                                                                                                                          |
| pgTAP                           | **98/98** (70 profile incl. role_played cap + frozen snapshot)                                                                                                                                                                                                                                                                                                                                                                  |
| Integration                     | 15/15                                                                                                                                                                                                                                                                                                                                                                                                                           |
| e2e                             | **28/28** — business path (rôle→confirmation→compétence→correction→rejet/restauration→preuve→rattachement→détachement), dedicated never-re-asked assert, reload lands on the identical projection, honest `paused` terminal (second synthetic user), Approfondir flow, anonymous redirect, axe light+dark, keyboard, 390/414 no-overflow + composer never masks (owner rule: 320 no longer blocking), double-click = one record |
| Mutation protocol under load    | full business path green under 4x CPU throttle (10/10 dead-click repro before the fix; 3/3 clean after)                                                                                                                                                                                                                                                                                                                         |
| Visual proof                    | real browser captures: desktop light/dark, proposal state, mobile 390 light + 320 dark; mobile shell re-checked at 390/414 after Option A                                                                                                                                                                                                                                                                                       |

## Review findings

| Reviewer                | Severity  | Finding                                                                                                                                                                                                                                       | Resolution                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| impl                    | **major** | double-submit lock only covered the refresh, not the mutation window (duplicate evidence chain possible; false error on double-decide)                                                                                                        | **fixed**: in-flight lock across the whole round-trip, all controls gated + dedicated double-click e2e (one record, no false alert)                                                                                                                                                                                                                    |
| impl                    | minor     | no `/profile` error boundary                                                                                                                                                                                                                  | fixed (`error.tsx` mirroring siblings)                                                                                                                                                                                                                                                                                                                 |
| impl                    | minor     | partial evidence chain hidden until reload; no recovery affordance                                                                                                                                                                            | fixed (honest refresh on failure + «Confirmer» affordance on proposed evidence in the panel)                                                                                                                                                                                                                                                           |
| impl                    | minor     | completion chips were dead affordances                                                                                                                                                                                                        | fixed (Thread `onChip` + `ask_extra` enrichment mode)                                                                                                                                                                                                                                                                                                  |
| impl                    | minor     | `as never` casts                                                                                                                                                                                                                              | fixed (named `ClaimKind`/`ClaimState` casts)                                                                                                                                                                                                                                                                                                           |
| impl                    | minor     | keyboard focus lost after a decision                                                                                                                                                                                                          | fixed (focus handed to the persistent composer)                                                                                                                                                                                                                                                                                                        |
| impl                    | info ×3   | years-regex naivety (commented — confirm-first proposal) · «appuyé» label reused on link rows · detached links never listed (verified)                                                                                                        | noted                                                                                                                                                                                                                                                                                                                                                  |
| security                | —         | migration ACLs (CREATE OR REPLACE preserves + re-revoke belt-and-suspenders), zero direct DB access in UI, free text = React text only (no HTML sink, no ReDoS, no logging), secrets confined to test provisioning, /profile double-gated     | **PASS** (0 finding)                                                                                                                                                                                                                                                                                                                                   |
| codex p1                | major ×2  | the in-flight lock read stale React state (two near-simultaneous submits could both enter)                                                                                                                                                    | **fixed**: synchronous ref-based lock (authoritative, closure-immune); Composer swallows onSend failures and keeps the text                                                                                                                                                                                                                            |
| codex p1                | minor     | dismissed evidence suggestion returns after refresh                                                                                                                                                                                           | **rebutted, by design**: the thread is a stateless projection; the «never nagged» rule is for REJECTED claims — an unsupported achievement legitimately keeps its suggestion (dismiss is per-session)                                                                                                                                                  |
| codex p1                | info ×2   | «verbatim» proposals are length-capped · migration re-revokes the private snapshot builder without re-grant                                                                                                                                   | documented: caps are deliberate bounds (user sees + confirms); the builder is intentionally app-role-private (DEFINER-internal)                                                                                                                                                                                                                        |
| codex p2                | major ×2  | panel link rows reused the «appuyé» wording regardless of tiers · the deepen card kept Confirmer beside the follow-up (two active paths)                                                                                                      | **fixed**: link rows now name their claim («Rattachée à … ») ; the reviewed card offers only the owner-defined Ignorer escape — confirmation happens on the replacement proposal                                                                                                                                                                       |
| codex p2                | minor     | Approfondir had no browser-level proof                                                                                                                                                                                                        | **fixed**: dedicated e2e (follow-up question visible · no Confirmer on the reviewed card · replacement proposal · human confirmation)                                                                                                                                                                                                                  |
| codex p3                | —         | no blocker/major/minor findings                                                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                                                                                      |
| codex p4                | major     | after the CI-robustness test fixes: the `complete` wording («socle en place») overstated a foundation left below 6/6 by REJECTED elements                                                                                                     | **fixed (owner-authorized bounded repair)**: distinct honest `paused` terminal («Il ne reste rien à demander pour le moment. X éléments sur 6 sont confirmés…»), `complete` reserved for 6/6, no chips, Restaurer unchanged; +2 unit tests (5/6 rejected-skill; 0/6 all-rejected) + 1 e2e proving the real message and the absence of «socle en place» |
| impl (targeted, pass 4) | minor     | EN copy singular agreement                                                                                                                                                                                                                    | fixed                                                                                                                                                                                                                                                                                                                                                  |
| impl (targeted, pass 5) | **major** | `handleEvidenceSubmit` applied the canonical snapshot only after ALL three sub-actions succeeded — a mid-chain failure hid the committed evidence row and its panel «Confirmer» recovery (props no longer re-sync), regressing an earlier fix | **fixed**: each successful sub-action applies its returned snapshot immediately; stale catch comment corrected. No automated fault-injection proof (forcing a mid-chain server failure needs a test hook — noted limit); covered by review + the existing double-click e2e                                                                             |
| impl (targeted, pass 5) | minor ×3  | post-commit `loadSnapshot` failure returned a dishonest `ok:false` · panel controls still used native `disabled` (consistency with the dead-click fix) · this loop record was stale (mobile nav, counts, 320 rule)                            | **fixed**: snapshot read isolated (structured log, `ok:true` with snapshot omitted — client degrades gracefully) · shared `busyProps` on every panel mutation control · record updated (this revision)                                                                                                                                                 |
| impl (targeted, pass 5) | info ×4   | redundant Input classes · contradictory state-seeding comment · nav `sm:flex-nowrap` · dead `before.facts` capture in the reload e2e                                                                                                          | comment fixed, `sm:flex-nowrap` added, reload e2e now asserts the captured panel facts; redundant classes left (harmless)                                                                                                                                                                                                                              |
| codex final re-review   | —         | **DEFERRED — Codex quota exhausted until 2026-07-29 (owner decision)**: the pass-4/5 repairs are covered by the targeted implementation reviews + tests; the independent Codex re-review of the remaining diff will run when quota returns    | recorded in the PR                                                                                                                                                                                                                                                                                                                                     |

## Known limits (honest)

Evidence create→confirm→attach remains a 3-action chain (each committed step
is applied to the surface immediately, failures surface honestly and are
recoverable in-UI); a single transactional action is a possible PR C-era
hardening. 320 px is no longer a blocking criterion (owner rule) — the shell
is proven at 390/414; extreme-narrow polish is deferred. The M1 repair
(mid-chain snapshot application) has no automated fault-injection proof —
forcing a server failure between sub-actions needs a test hook that is out
of the authorized scope. The independent Codex re-review of the attempt-5
diff is deferred to 2026-07-29 (quota, owner decision).

## Stop

- **requiresHumanApproval**: yes
- **stopReason**: PR B MERGED — owner explicitly approved PR #5 at head
  `c7ae999`; squash-merged to main as `bb0fd88` (2026-07-23), branch
  deleted, main CI green. All gates green locally and in CI (76 unit ·
  98 pgTAP · 15 integration · 28 e2e). The deferred Codex re-review
  (2026-07-29) remains recorded as a complementary, non-blocking control.
  Versions/history/compare (PR C) not started — awaiting the owner's brief.
