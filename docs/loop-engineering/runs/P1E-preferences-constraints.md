# Task Loop Record — Phase 1 / PR E — Target preferences & hard constraints

- **schemaVersion**: 1.0
- **taskId**: P1E-preferences-constraints
- **goal**: Close Phase 1's last roadmap deliverable — the user states their
  target preferences and hard constraints (the profile's live positioning
  the Phase 3 matching engine will read). A dedicated `/profile/preferences`
  form, all fields optional, never blocking the interview.
- **status**: completed
- **attempt**: 1
- **startedAt**: 2026-07-24T00:20:00+02:00
- **startSha**: `abb461a`; rebased onto `dc2debe` (main after PR D) — panel
  links conflict resolved (Historique + Préférences coexist)
- **branch**: `feat/phase-1-preferences` (PR #9)

## Scope

Roadmap Phase 1: "target preferences and hard constraints". DOMAIN_MODEL.md
places these directly on `candidate_profiles` (current positioning, NOT
versioned claims — matching reads them live). All fields optional.

- **Migration** (`20260723201500_phase1e_preferences_constraints.sql`):
  adds 11 columns (5 jsonb string lists, day-rate ints with a coherence
  CHECK, enum text columns for currency/remote-policy/travel, a free-text
  timezone_overlap). Structural + enum bounds in the DB; a validation
  trigger checks every list element (type, 1-120 chars, ≤20 entries) and the
  engagement-type vocabulary, so a privileged writer cannot smuggle bad
  content either. Column-scoped `grant update(...)` for `authenticated` (the
  RLS owner-row policy stays the row filter; the grant is the column filter).
- **Domain** (`src/domain/profile.ts`): `profilePreferencesSchema` Zod
  mirror + enum consts, exact bounds, rate-floor refine.
- **Logic** (`logic.ts`): `loadPreferences` / `savePreferences` (session
  client, RLS in force).
- **Action** (`actions.ts`): `savePreferencesAction` — DAL → own-profile →
  Zod → save → sanitized result + isolated revalidate.
- **UI**: `/profile/preferences` (server page + client form + loading/error),
  sections Ciblage / Conditions / Exclusions; native selects for enums;
  engagement types as toggle buttons; ref-lock + aria-busy on submit; a
  « Préférences & contraintes » link added to the profile panel.
- **Copy**: FR + EN.

## Owner note (infra)

During this PR the owner forwarded a Vercel bot comment: a preview deploy
was blocked because commits authored by the `cve-goog` GitHub identity are
not linked to the Vercel team. Root-cause fix applied at the repo level:
`git config --local user.*` set to the Vercel-linked `Christophevanengelen`
identity so all future commits (and worktrees) deploy. NOT done — creating
accounts, adding Vercel team members, or granting broad rights to
automation: out of remit / security anti-pattern; left to the owner.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **88/88 unit** · build                                                                                                                                                                                                                                                                                                                                                                                  |
| pgTAP       | **113/113** (+15: owner writes own prefs under the column grant; anon/cross-user denied; every CHECK + trigger branch — bad currency/remote/rate-cap/rate-floor, unknown engagement type, non-string element, whitespace-only element, >20 entries; non-granted column stays unwritable)                                                                                                                                                           |
| integration | **23/23** (+4: full round-trip, clear-to-defaults, DB rejects incoherent floor past the app, cross-user write hidden by RLS)                                                                                                                                                                                                                                                                                                                       |
| e2e         | **30/30** — new: edit → save → reload persists (server truth) → incoherent floor refused honestly + axe scan                                                                                                                                                                                                                                                                                                                                       |
| reviews     | security **PASS** (0 finding above info: both auth layers, exact 11-column grant, Zod↔DB parity, no markup sink, sanitized errors). implementation **PASS** (0 critical/high/medium; 1 Low repaired — the trigger now measures list-element length AND normalises timezone_overlap AFTER trimming, so the DB enforces exactly the Zod `trimmed()` semantics, +1 pgTAP locking a whitespace-only element rejection; informational notes left as-is) |
| CI          | (to fill)                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Known limits / notes

- Panel-link placement overlaps the same region PR D touches; whichever of
  D/E merges second needs a trivial rebase of the profile panel links.
- `hard_exclusions` are stated by the user; the actual exclusion ENGINE is
  Phase 3 — this PR only captures and stores the criteria.

## Stop

- **requiresHumanApproval**: yes (merge)
- **stopReason**: PR E complete — all local gates green (88 unit · 113 pgTAP
  · 23 integration · 31 e2e post-rebase), both independent reviews PASS (1
  Low repaired), rebased onto main (PR D) and **PR #9 CI fully green**.
  Closes Phase 1's last roadmap deliverable; all six Phase 1 deliverables
  are now covered. Awaiting explicit owner merge approval. Note: the PR #9
  Vercel preview runs against the hosted DB, which receives PR E's migration
  only on merge to main (no Supabase Branching on the free plan) — the
  `/profile/preferences` page fully exercises only after merge; CI proves it
  on the isolated local stack meanwhile.
