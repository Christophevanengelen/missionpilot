# Task Loop Record — Phase 1 / PR B — Guided profile interview experience

- **schemaVersion**: 1.0
- **taskId**: P1B-profile-experience
- **goal**: The first genuinely usable business vertical: an authenticated,
  deterministic, guided professional interview at `/profile` that turns
  conversation into the PR A foundation's structured, verifiable claims and
  evidence — premium Studio-calme UX, French-first, honest at every level.
- **status**: completed
- **attempt**: 4 (1 = build; 2 = Claude review repairs; 3 = Codex repairs ×2
  — budget cap; 4 = owner-authorized bounded repair, honest `paused` terminal)
- **startedAt** / **completedAt**: 2026-07-23T15:00:00+02:00 / 2026-07-23T16:30:00+02:00

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
Tests: `tests/unit/interview-engine.test.ts` (18) ·
`tests/e2e/profile-interview.spec.ts` (7) · pgTAP +2 (plan 70) · fixtures.

## Checks (evidence)

| Check                           | Result                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (74 unit) + build | passed                                                                                                                                                                                                                                                                       |
| pgTAP                           | **98/98** (70 profile incl. role_played cap + frozen snapshot)                                                                                                                                                                                                               |
| Integration                     | 15/15                                                                                                                                                                                                                                                                        |
| e2e                             | **25/25** — business path (rôle→confirmation→compétence→correction→rejet/restauration→preuve→rattachement→détachement), dedicated never-re-asked assert, anonymous redirect, axe light+dark, keyboard, 320/390 no-overflow + composer never masks, double-click = one record |
| Visual proof                    | real browser captures: desktop light/dark, proposal state, mobile 390 light + 320 dark                                                                                                                                                                                       |

## Review findings

| Reviewer                | Severity  | Finding                                                                                                                                                                                                                                   | Resolution                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| impl                    | **major** | double-submit lock only covered the refresh, not the mutation window (duplicate evidence chain possible; false error on double-decide)                                                                                                    | **fixed**: in-flight lock across the whole round-trip, all controls gated + dedicated double-click e2e (one record, no false alert)                                                                                                                                                                                                                    |
| impl                    | minor     | no `/profile` error boundary                                                                                                                                                                                                              | fixed (`error.tsx` mirroring siblings)                                                                                                                                                                                                                                                                                                                 |
| impl                    | minor     | partial evidence chain hidden until reload; no recovery affordance                                                                                                                                                                        | fixed (honest refresh on failure + «Confirmer» affordance on proposed evidence in the panel)                                                                                                                                                                                                                                                           |
| impl                    | minor     | completion chips were dead affordances                                                                                                                                                                                                    | fixed (Thread `onChip` + `ask_extra` enrichment mode)                                                                                                                                                                                                                                                                                                  |
| impl                    | minor     | `as never` casts                                                                                                                                                                                                                          | fixed (named `ClaimKind`/`ClaimState` casts)                                                                                                                                                                                                                                                                                                           |
| impl                    | minor     | keyboard focus lost after a decision                                                                                                                                                                                                      | fixed (focus handed to the persistent composer)                                                                                                                                                                                                                                                                                                        |
| impl                    | info ×3   | years-regex naivety (commented — confirm-first proposal) · «appuyé» label reused on link rows · detached links never listed (verified)                                                                                                    | noted                                                                                                                                                                                                                                                                                                                                                  |
| security                | —         | migration ACLs (CREATE OR REPLACE preserves + re-revoke belt-and-suspenders), zero direct DB access in UI, free text = React text only (no HTML sink, no ReDoS, no logging), secrets confined to test provisioning, /profile double-gated | **PASS** (0 finding)                                                                                                                                                                                                                                                                                                                                   |
| codex p1                | major ×2  | the in-flight lock read stale React state (two near-simultaneous submits could both enter)                                                                                                                                                | **fixed**: synchronous ref-based lock (authoritative, closure-immune); Composer swallows onSend failures and keeps the text                                                                                                                                                                                                                            |
| codex p1                | minor     | dismissed evidence suggestion returns after refresh                                                                                                                                                                                       | **rebutted, by design**: the thread is a stateless projection; the «never nagged» rule is for REJECTED claims — an unsupported achievement legitimately keeps its suggestion (dismiss is per-session)                                                                                                                                                  |
| codex p1                | info ×2   | «verbatim» proposals are length-capped · migration re-revokes the private snapshot builder without re-grant                                                                                                                               | documented: caps are deliberate bounds (user sees + confirms); the builder is intentionally app-role-private (DEFINER-internal)                                                                                                                                                                                                                        |
| codex p2                | major ×2  | panel link rows reused the «appuyé» wording regardless of tiers · the deepen card kept Confirmer beside the follow-up (two active paths)                                                                                                  | **fixed**: link rows now name their claim («Rattachée à … ») ; the reviewed card offers only the owner-defined Ignorer escape — confirmation happens on the replacement proposal                                                                                                                                                                       |
| codex p2                | minor     | Approfondir had no browser-level proof                                                                                                                                                                                                    | **fixed**: dedicated e2e (follow-up question visible · no Confirmer on the reviewed card · replacement proposal · human confirmation)                                                                                                                                                                                                                  |
| codex p3                | —         | no blocker/major/minor findings                                                                                                                                                                                                           | —                                                                                                                                                                                                                                                                                                                                                      |
| codex p4                | major     | after the CI-robustness test fixes: the `complete` wording («socle en place») overstated a foundation left below 6/6 by REJECTED elements                                                                                                 | **fixed (owner-authorized bounded repair)**: distinct honest `paused` terminal («Il ne reste rien à demander pour le moment. X éléments sur 6 sont confirmés…»), `complete` reserved for 6/6, no chips, Restaurer unchanged; +2 unit tests (5/6 rejected-skill; 0/6 all-rejected) + 1 e2e proving the real message and the absence of «socle en place» |
| impl (targeted, pass 4) | minor     | EN copy singular agreement                                                                                                                                                                                                                | fixed                                                                                                                                                                                                                                                                                                                                                  |
| codex final re-review   | —         | **DEFERRED — Codex quota exhausted until 2026-07-29 (owner decision)**: the pass-4 repair is covered by the targeted implementation review + tests; the independent Codex re-review of this last diff will run when quota returns         | recorded in the PR                                                                                                                                                                                                                                                                                                                                     |

## Known limits (honest)

The dashboard shell's fixed left nav (Phase 0 heritage) stays visible at
320 px — no overflow (e2e-proven) but tight; a shell-nav mobile pass is a
separate task, out of PR B scope. Evidence create→confirm→attach remains a
3-action chain (failures now surface honestly and are recoverable in-UI); a
single transactional action is a possible PR C-era hardening.

## Stop

- **requiresHumanApproval**: yes
- **stopReason**: PR B complete — deterministic interview live on the real
  foundation, all gates green, reviews recorded; awaiting PR CI, final Codex
  verdict and explicit owner approval. Versions/history/compare (PR C) not
  started.
