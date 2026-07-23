<!-- MissionPilot PR — every merge follows docs/loop-engineering/PR_PROTOCOL.md -->

## What & why

<!-- One paragraph. Link the task/milestone and its loop record under
docs/loop-engineering/runs/ if applicable. -->

## Checklist (all required before requesting merge)

- [ ] `pnpm verify:full` green locally (paste the summary below)
- [ ] Loop Engineering record updated (`docs/loop-engineering/runs/…`)
- [ ] No secret, personal data or `.env*` content in the diff
- [ ] No scope creep: the diff matches the declared task only

## UX criteria (for any user-facing change — see `docs/ux/UX_PRINCIPLES.md`)

Skip if the PR touches no user-facing surface; otherwise all that apply:

- [ ] New capability is reachable conversationally, or documents why a
      structured view is primary
- [ ] AI-derived values surface as cards with a state
      (`proposed`/`confirmed`/`needs_review`/`rejected`) and their actions
- [ ] Claims show evidence; scores are explainable component by component
- [ ] No known information is asked twice
- [ ] External effects go through the approval card; decline is as prominent
      as approve
- [ ] loading / empty / error / offline / retry states exist, in the product
      voice
- [ ] Keyboard-only path verified; axe clean (serious/critical); reduced
      motion respected; light + dark checked
- [ ] Mobile and desktop layouts verified (`docs/ux/RESPONSIVE_STRATEGY.md`)

## Quality gates evidence

```text
(paste: unit / pgTAP / integration / e2e summaries)
```

## Claude Code review (implementation + security)

<!-- Paste the reviewers' verdicts: findings with severity and resolution.
The implementer never approves their own work. -->

## Codex review

<!-- Paste the Codex CLI review verdict, or write "pending — owner runs
`codex review`" and wait for it before merge. -->

## Product-owner validation

- [ ] Explicit merge approval given by the product owner (required — CI green
      alone is never sufficient)
