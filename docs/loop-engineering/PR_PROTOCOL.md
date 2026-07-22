# Pull Request Protocol (Claude Code / Codex collaboration)

Applies to every change to `main`. Complements `LOOP_CONTRACT.md` (the
development loop) with the repository-level merge rules decided by the
product owner for this solo-maintainer phase.

## Rules

1. **No direct pushes to `main`.** Every change lands through a pull request,
   including agent-authored changes. `main` never moves without a PR.
2. **Required checks green**: both CI jobs — `Quality gates (no services)`
   and `Database and e2e gates (isolated local stack)` — must pass. They run
   the exact same scripts as local development (`pnpm verify`, `test:rls`,
   `test:integration`, `test:e2e`); never weaken or fork them.
3. **All conversations resolved** before merge.
4. **Reviews recorded in the PR body** (template sections):
   - _Claude Code review_: the read-only `implementation-reviewer` (every PR)
     and `security-reviewer` (PRs touching auth, data, workflows, CI or
     release) verdicts, with findings and resolutions;
   - _Codex review_: `codex review` output on the diff, or an explicit
     "pending" note — a PR is not mergeable while a review is pending.
5. **Product-owner validation is the merge trigger.** Zero GitHub approvals
   are required by configuration (solo account), so the owner's explicit
   "merge approved" — in the PR or to the agent — is what authorizes the
   merge. CI green alone never merges anything.
6. **Repair limits**: review findings are fixed on the PR branch within the
   loop limits (max 3 repair rounds, `STOP_CONDITIONS.md`); unresolvable
   findings escalate to the owner instead of being argued away.

## Why zero required GitHub approvals

GitHub cannot let a PR author approve their own PR; on a single-maintainer
repository a required-approval rule would deadlock every merge. The controls
above (required checks, recorded reviews, owner validation) replace it and
are enforced by discipline and by branch protection where the plan allows.
