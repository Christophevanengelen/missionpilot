# Task Loop Record — Phase 1 / PR D — Confirm a profile version from the UI

- **schemaVersion**: 1.0
- **taskId**: P1D-profile-publish
- **goal**: Close the last Phase 1 gap: the publication contract (PR A) has
  had no user-facing path — versions could only be created by script. Add a
  minimal « Versions » section to the existing profile panel: current
  version, a « Confirmer une version du profil » action with honest
  outcomes, next to the existing « Historique » link.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-23T23:59:00+02:00
- **startSha**: `abb461a` (main, clean)
- **branch**: `feat/phase-1-profile-publish`

## Scope (deliberately minimal)

- UI + copy ONLY: no schema change, no RLS change, no server-action change
  (`publishVersionAction` is used exactly as shipped in PR A), no SQL.
- Panel section « Versions » in `profile-interview.tsx`: current version
  number (seeded server-side, updated from the action's own return),
  publish button gated on ≥1 confirmed claim (an empty snapshot is never
  offered), PR B conventions (synchronous ref lock + aria-busy).
- Honest outcomes: created=true → « Version N confirmée » + the
  deterministic summary; created=false → « Aucun changement de fond depuis
  la version N — aucune nouvelle version n'a été créée. »; failure →
  existing generic error. Summaries stay system-generated (owner rule).
- ONE critical e2e appended to the history spec (serial): confirm the
  pending skill → publish → « Version 4 confirmée » → publish again →
  honest no-op → history lists the new version as latest.
- Security reviewer: N/A with justification — zero new input surface (one
  button calling an unchanged, already-reviewed action), no data-model or
  auth change. Implementation review: targeted.

## Repair during build (demonstrated, fixed before review)

The first full-suite run failed 2 tests and exposed a REAL product defect:
the button was initially named « Confirmer une version du profil », and
Playwright's getByRole name matching is substring-based — the interview's
unscoped « Confirmer » clicks could resolve to the panel button during a
render window (observed: the business-path e2e froze a version instead of
confirming a claim; an ambiguous affordance name is a USER hazard too, not
just a test one). Product fix: renamed to « **Figer une version du
profil** » (semantically truer — immutable snapshot; the helper text
already said « figer »). The PR B interview spec was NOT modified. The new
e2e's flow assumption was also corrected (the minimal seed has no
seniority: the interview asks it first).

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **88/88 unit** · build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| pgTAP       | **98/98** (unchanged — no SQL in this PR)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| integration | **19/19** (unchanged contracts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| e2e         | **30/30** — new: seniority confirm → « Version 4 figée — « Séniorité renseigné » » → honest no-op re-freeze → history shows V4 latest, no ghost V5                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| reviews     | implementation **PASS** — scope, conventions, honest outcomes and naming verified against code; 1 medium repaired (serial mode on the ordered e2e chain: CI retries re-run from the fresh seed instead of stranding later tests), 2 lows repaired (transport-unknown copy « pendant la publication de la version » ; honest no-op also syncs the displayed head number from the action's own return), 1 low deferred (pre-existing French agreement in generated summaries — flagged as its own follow-up task), infos noted. Security review N/A: zero new input surface (one button on an unchanged, already-reviewed action). |
| CI          | (to fill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Stop

- **requiresHumanApproval**: yes (merge)
- **stopReason**: —
