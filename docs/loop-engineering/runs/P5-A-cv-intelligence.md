# Task Loop Record — Phase 5 / PR A — LLM CV analysis → auto-filled profile

- **schemaVersion**: 1.0
- **taskId**: P5-A-cv-intelligence
- **goal**: First slice of the owner's fluidity mandate ("j'ai l'impression
  d'être dans un programme des années 90 — tout doit être automatisé"): ONE
  deep LLM analysis of the CV replaces the keyword-chip flow. The system
  infers the PRIORITY role from the experiences (recency, duration,
  progression), the recurrence-weighted core skills (max 15 — no keyword
  dump), seniority, years, a summary, and 1-3 target métiers — reviewed on a
  single "Voici ce que j'ai compris" screen and applied in ONE click.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T18:30:00+02:00
- **startSha**: `cbaf182` (main, after Phase 4 PR 5)
- **branch**: `feat/phase-5-cv-intelligence`

## Owner decisions (recorded)

- Full plan (A: LLM CV analysis → B: auto-chained discovery → C: LLM offer
  scoring with "pourquoi ce match" → D: fluid onboarding) approved: "go".
- OpenAI usage approved and ACTIVE in production (gpt-4o-mini).
- The single review-screen validation counts as the honest confirmation —
  claims are created AND confirmed in one click; everything stays adjustable
  through the normal profile lifecycle afterwards.

## Scope (no migration)

- **`cv-ai.ts`**: `aiAnalyzeCvProfile(text)` — task `cv-profile-analysis`
  (prompt `cv-profile-1`): strict all-required/nullable dataSchema
  {roleTitle, roleRationale, seniorityLevel?, yearsExperience?, summary,
  coreSkills 1-15, targetRoles 1-3}. French prompt; "n'invente RIEN qui ne
  soit pas dans le CV". Null on unconfigured/failure (never breaks the flow).
- **`cv-actions.ts`**: `analyzeCvAction` returns the deep profile when AI
  works — and then shows ONLY the curated core skills (owner mandate: no
  keyword dump). Fallback = previous deterministic+light-AI chip merge.
  `applyCvProfileAction` = thin wrapper over…
- **`cv-apply.ts`** (testable logic): `applyCvProfile(client, profileId,
input)` — creates AND confirms role/seniority/years/summary/skills
  (single-valued kinds SUPERSEDE their active predecessor → re-analysis just
  works; known skills skipped case-insensitively) and stores targetRoles in
  `preferences.targetRoleFamilies` (drives discovery — PR B chains it).
- **UI `cv-import.tsx`**: new "understood" step — role + rationale +
  seniority/years, summary, toggleable core-skill chips, target métiers, ONE
  button "C'est bien moi — tout ajouter" → applied state with "Découvrir mes
  offres" CTA. Chip flow remains the keyless fallback. Copy FR+EN.

## Key safety

- CV text stays DATA (provider injection boundary + double envelope
  validation); nothing persisted but the applied claims/preferences. The
  model output is a PROPOSAL — the user's single validation is explicit and
  everything remains editable. RLS owner-only; no migration.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **176/176 unit** · build                                                                                                                                                                                                                                                                                                  |
| unit        | **176** (+1: profile-analysis gating — unconfigured ⇒ null, zero network)                                                                                                                                                                                                                                                                                            |
| integration | **38** (+2: one-step apply ⇒ 7 CONFIRMED claims + targetRoleFamilies; re-analysis supersedes single-valued claims and skips known skills)                                                                                                                                                                                                                            |
| e2e         | **35/35** — keyless path (chip flow) unchanged                                                                                                                                                                                                                                                                                                                       |
| reviews     | Implementation **PASS** (wire schema verified empirically against OpenAI's strict subset; supersede semantics verified against the SQL), Security **PASS** (mandatory human review screen is the only path to persistence; no new capability delta; no dangerous sinks). **5 minors confirmed and repaired** (below). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit; re-run after the repairs.                                                                                                                                                                                                                                                                                                          |

## Review repairs (before merge)

- **Docstring** contradicted the deep path (claimed the deterministic detector
  "always runs") — reworded.
- **Kept-selected skills silently no-oped** against existing
  `proposed`/`needs_review` claims: the review-screen validation now CONFIRMS
  them (legal transitions), counted honestly; `rejected` stays deliberately
  untouched (a rejection is never silently overridden). Integration test
  added (Kafka case).
- **Stale `claimToSupersede`** from our own snapshot added a failure path —
  dropped; the replace RPC's ATOMIC auto-close supersedes the current active
  claim (verified against the SQL by the reviewer).
- **Task instruction rode inside the untrusted-data envelope** (same trust
  level as hostile CV text). `AiRequest.taskInstruction` added: server-
  authored instructions now ride on the TRUSTED side (system message);
  `input` carries only untrusted content. Provider test asserts the
  separation on the actual request body.
- **`needs_review` was discarded** on a path ending in CONFIRMED claims:
  `CvProfileUnderstanding.needsReview` now propagates and the review screen
  shows a visible caution banner ("l'assistant n'était pas certain…").

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then PR B (auto-chained discovery).
- **stopReason**: —
