# Task Loop Record — P1A.1: French participle agreement in change summaries

- **schemaVersion**: 1.0
- **taskId**: P1A.1-change-summary-accord
- **goal**: `buildChangeSummary` produced invariable past participles
  (« Séniorité renseigné »). Agree renseigné/retiré/mis à jour with the
  gender AND number of each single-valued label, without breaking any
  existing assertion or the in-flight P1D e2e prefix match.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt** / **completedAt**: 2026-07-23T21:45:00+02:00 /
  2026-07-23T22:15:00+02:00
- **startSha**: `abb461a` (main) — **branch**:
  `fix/change-summary-gender-agreement` (own worktree; the P1D working
  tree on `feat/phase-1-profile-publish` was left untouched)

## Acceptance criteria

- [x] Séniorité (f sg) → renseignée · retirée · mise à jour.
- [x] Années d'expérience (f pl) → renseignées · retirées · mises à jour
      (number agreement added beyond the requested gender-only accord:
      « Années d'expérience renseignée » would swap one fault for another).
- [x] Rôle / Résumé (m sg) byte-identical to before.
- [x] No committed assertion or fixture expects the old exact form
      (grep over src, tests, supabase, prompts, docs: only e2e
      « Rôle mis à jour », masculine, unchanged).
- [x] The uncommitted P1D spec prefix regex
      `/Version 4 figée — « Séniorité renseigné/` still matches the new
      « Séniorité renseignée » (substring match, no anchor).

## Constraints

- Pure copy fix: no schema, no SQL, no UI, no dependency change.
- Stored `change_summary` rows are immutable audit data: old versions
  keep the old wording (accepted; noted in the PR description).

## Actions (files)

- `src/lib/profile/change-summary.ts` — `SINGLE_LABELS` entries become
  `{ label, accord }` with `accord: "" | "e" | "es"` (past-participle
  agreement suffix); the three template literals apply it
  (`renseigné${accord}` · `retiré${accord}` · `mis${accord} à jour`).
  The literal union forces a conscious extension for any future
  masculine-plural label instead of a silent mis-agreement.
- `tests/unit/change-summary.test.ts` — 2 new tests pinning all 6
  feminine forms + 1 assertion pinning « Rôle retiré » (review finding):
  the full 12-form matrix (4 labels × 3 verbs) is now asserted.

## Checks

| Check       | Command                 | Result                                                                                                                                                                         |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| verify      | `pnpm verify`           | passed — format:check · lint · typecheck · **90/90 unit** · build                                                                                                              |
| integration | `pnpm test:integration` | skipped — integration tests use synthetic summaries (« course A »), never the generated strings (grep-verified)                                                                |
| pgTAP       | `pnpm test:rls`         | skipped — no SQL touched; DB only checks `char_length(change_summary)`                                                                                                         |
| e2e         | `pnpm test:e2e`         | skipped locally (no stack in this session) — **passed in CI**: « Database and e2e gates (isolated local stack) » green on the PR                                               |
| CI          | PR #8 checks            | passed — Quality gates 1m15s · Database and e2e gates 4m37s; Vercel Preview not deployed (git author `cve-goog` lacks Vercel project access — infra, not code; owner decision) |

## Evidence

- Old form referenced nowhere on main except the source itself; the only
  external match, e2e « Rôle mis à jour … » (lines 115/170), is masculine
  and byte-identical — and is injected as a literal RPC fixture, not
  generated.
- Reviewer derived all 12 produced forms by hand; « mis(e)(s) à jour »
  works by suffixation because the feminine of « mis » is suffix-formed.
- Sentence capitalization unaffected: every label already starts
  uppercase.

## Review findings

| Reviewer                | Severity | Finding                                                                             | Resolution                                  |
| ----------------------- | -------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| implementation-reviewer | minor    | « Rôle retiré » was the only unpinned cell of the 12-form matrix                    | fixed — assertion added, suite re-run green |
| implementation-reviewer | info     | Historical DB rows keep the old wording (immutable audit data)                      | accepted — noted in PR description          |
| implementation-reviewer | info     | No combined-sentence test with a feminine part mid-list; join logic already covered | accepted                                    |

security-reviewer not run: pure display-string change, no auth/data/
workflow/CI surface (per CLAUDE.md scope rule).

## Next action

Owner reviews and merges the PR once CI is green.

- **requiresHumanApproval**: yes
- **stopReason**: PR opened with green local gates and PASS independent
  review; stopping before merge per owner instruction.
