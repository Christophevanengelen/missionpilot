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

| Check       | Result                                                                                                                                                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **158/158 unit** · build (unpdf bundled)                                                                                                                                                                                                                                               |
| unit        | **158** (+5 detector: aliases/dedup/order, word boundaries, punctuation names, extension-suffix fix, honesty)                                                                                                                                                                                                                     |
| integration | **34** (unchanged — skill claims reuse the PR A path already covered)                                                                                                                                                                                                                                                             |
| e2e         | **35** (+1: paste CV → 5 chips all pressed → unselect one → "4 compétences ajoutées" → axe-clean)                                                                                                                                                                                                                                 |
| reviews     | Security **PASS** (auth-gated actions, taxonomy-only RegExp — no user-controlled pattern/ReDoS, CV never persisted or logged, RLS-only writes, unpdf pinned post-CVE). Implementation **CHANGES_REQUESTED** → **1 MAJOR + minors confirmed and repaired** (below); re-gated green. Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit; re-run after the repairs.                                                                                                                                                                                                                                                                       |

## Review repairs (before merge)

- **CONFIRMED MAJOR — 10 MB cap unreachable.** Next 16's server actions
  default to a **1 MB body limit** and `next.config.ts` didn't raise it: any
  CV over 1 MB was rejected by the framework before the action ran (the
  10 MB check was dead code) with a misleading generic error. Fixed:
  `experimental.serverActions.bodySizeLimit: "10mb"` (placement verified in
  Next 16.2.11 types) + a client-side `file.size` pre-check with a dedicated
  "fichier trop volumineux" message (FR+EN).
- **CONFIRMED minor — taxonomy (66) > add cap (50).** A fully-selected
  keyword-rich CV couldn't be submitted. Fixed: cap raised to 100.
- **Security hardening (recommended) — extraction bounds.** A small crafted
  PDF could expand to huge text (compression bomb) or thousands of pages.
  Fixed: `MAX_PAGES = 80` + extracted text capped at 300k chars; `CvPdfError`
  re-thrown untouched.
- **Coverage gap — PDF path untested.** Added unit tests for the safety
  bounds (empty / oversize / corrupt ⇒ typed `CvPdfError`), with
  `server-only` mocked.

## Consciously accepted (documented, not repaired)

- **Rejected skills count as "already present"** in the import skip — a skill
  the user explicitly rejected is not silently re-proposed; the interview's
  restore flow exists for that.
- **Common-word false positives** (e.g. "go-live" → Go, "swift" → Swift) —
  acceptable by design: chips are proposals with a human in the loop; the
  later LLM brick improves precision.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Next brick (OpenAI adapter) will need the owner
  to set `OPENAI_API_KEY` in Vercel — guided, never handled by me.
- **stopReason**: —
