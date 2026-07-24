# Task Loop Record — Phase 4 / PR 2 — CV upload → detected skills

- **schemaVersion**: 1.0
- **taskId**: P4-2-cv-skill-import
- **goal**: The "upload my CV" brick of the owner's onboarding vision: drop a
  CV (PDF) or paste its text → **deterministic skill detection** → the user
  picks which skills join their profile (as proposals in the normal claim
  lifecycle). Feeds the existing match scorer directly. No LLM in this brick
  (the OpenAI adapter is the NEXT brick — owner has an OpenAI account and
  approved AI usage).
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T10:15:00+02:00
- **startSha**: `3f8498a` (main, after Phase 4 PR 1)
- **branch**: `feat/phase-4-cv-skills`

## Owner decisions (recorded)

- Owner confirmed the discovery approach (legal sources + web search, no
  scraping of protected boards) and wants a **fluid, conversational, high-UX**
  onboarding: upload CV / LinkedIn export + recommendations → immediate
  matches, sortable by CDI/CDD/remote.
- Owner has an **OpenAI account** and approves LLM usage where relevant → the
  OpenAI adapter (deep CV understanding) is the next brick; this one is the
  deterministic baseline + safety net.

## Scope

- **`src/domain/skills-taxonomy.ts`**: curated skills list (+ aliases). HONESTY:
  detection only proposes taxonomy skills — never invents one.
- **`src/lib/profile/cv-extract.ts`** (pure): `detectSkills(text)` — Unicode
  word-boundary matching, de-duplicated canonical names. A "." immediately
  before a term is NOT a boundary (an extension-style suffix like "Node.js"
  must not trigger the "js" alias → no false JavaScript).
- **`src/lib/profile/cv-pdf.ts`** (server-only): `unpdf` text extraction, 10 MB
  cap, typed `CvPdfError`.
- **`src/lib/profile/cv-actions.ts`**: `analyzeCvAction` (PDF file or pasted
  text → detected skills; **stores nothing** — the CV is never persisted) and
  `addSkillsAction` (creates chosen skills via `submitClaim`, case-insensitive
  skip of ones already present).
- **UI `cv-import.tsx`** on the profile page (above the interview): upload +
  paste → detected-skill **toggle chips** (aria-pressed) → "Ajouter à mon
  profil" → honest added/already-present message. Copy FR+EN.

## Key safety / privacy

- The CV file/text is untrusted DATA, parsed structurally; **never persisted**
  (analysis is in-memory; only chosen skills are saved). RLS owner-only writes
  via the existing claim path. No LLM, no fetch, no migration.

## Fix found by e2e during implementation

The first e2e run failed: "Node.js" in the pasted CV triggered the "js" alias →
a phantom **JavaScript** chip (6 detected instead of 5). Fixed in the detector
(left boundary excludes "."), with a unit regression test; standalone "JS/TS"
still detects.

## Checks (evidence)

| Check       | Result                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **158/158 unit** · build (unpdf bundled)                           |
| unit        | **158** (+5 detector: aliases/dedup/order, word boundaries, punctuation names, extension-suffix fix, honesty) |
| integration | **34** (unchanged — skill claims reuse the PR A path already covered)                                         |
| e2e         | **35** (+1: paste CV → 5 chips all pressed → unselect one → "4 compétences ajoutées" → axe-clean)             |
| reviews     | (to fill after independent passes)                                                                            |
| CI          | (to fill after push)                                                                                          |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Next brick (OpenAI adapter) will need the owner
  to set `OPENAI_API_KEY` in Vercel — guided, never handled by me.
- **stopReason**: —
