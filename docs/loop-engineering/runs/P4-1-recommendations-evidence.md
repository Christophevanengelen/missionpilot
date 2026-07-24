# Task Loop Record — Phase 4 / PR 1 — Received recommendations → testimonial evidence

- **schemaVersion**: 1.0
- **taskId**: P4-1-recommendations-evidence
- **goal**: First brick of the owner's "peer proof" vision: let the user add a
  **received recommendation** (LinkedIn, email…) as a **`testimonial` evidence**
  item, with a **clickable verification link** so it can be traced back and
  trusted. The user pastes their own recommendation — the app never fetches or
  scrapes anything.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T09:15:00+02:00
- **startSha**: `d3fc7c7` (main)
- **branch**: `feat/phase-4-document-ingestion`

## Owner decision (recorded) & boundary

Owner wants recommendations as verifiable peer proof, and asked for automated
LinkedIn scraping. **Boundary held:** no scraping of LinkedIn (violates its
terms, risks the owner's account ban) — the legitimate paths are the user
**pasting** their own recommendation (their data, their right to copy) and,
later, their **own LinkedIn data export**. Each recommendation carries a
**verification URL** so "anyone can't just write anything" — the owner's
explicit requirement.

## Scope

- **`src/lib/profile/recommendation.ts`** (pure): `recommendationInputSchema`
  (recommender, relationship?, organization?, text, `sourceUrl?` — an http(s)
  verification link) + `buildTestimonialEvidence` → an `EvidenceInput` with the
  type **fixed to `testimonial`** and honest provenance (`url` when a link is
  given, else `user_stated`; always `user_confirmed` — never "externally
  verified").
- **`addRecommendationAction`** (`actions.ts`): validate → build → re-validate
  with `evidenceInputSchema` → `createEvidence` (reuses the existing evidence
  path; RLS owner-only). Type can never be set by the client.
- **`/profile/recommendations`** (new sub-page, like `/profile/preferences`):
  a paste form + a list of saved testimonials. The verification link renders as
  a **clickable** `target=_blank rel="noopener noreferrer nofollow"` anchor
  (safe: owner-only data the owner entered); a non-http(s) value never becomes
  a link. Linked from the dashboard nav.
- Copy FR+EN.

## Key safety

- No fetch, no scrape, no LLM, no migration. Pasted recommendation is untrusted
  DATA; `sourceUrl` is validated http(s) and rendered as a hardened external
  link only. (Distinct from the opportunity `source_url`, which stays plain
  text because it comes from ingested listing content; here the link is the
  owner's own verification reference, shown only to the owner under RLS.)

## Deferred (next bricks)

1. **LinkedIn data-export upload** → experiences (claims) + recommendations
   (testimonials) in bulk.
2. **CV upload + parsing** → detected skills as claims (deterministic first,
   LLM later — cost decision).
3. **Auto-discovery** of offers from ToS-permissive sources, keyed off the
   profile, feeding the existing gate + score.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **153/153 unit** · build                                                                                                                                                                                                                                                                           |
| unit        | **153** (+5: mapper always testimonial + honest provenance; url vs user_stated; schema requires recommender+text, http(s)-only link, strict)                                                                                                                                                                                                  |
| integration | **34** (+1: a recommendation with a link → stored as `testimonial`, `source_type=url`, reference kept, `user_confirmed`, via RLS)                                                                                                                                                                                                             |
| e2e         | **34** (+1: add a recommendation → listed with a CLICKABLE "Vérifier la source" link, `rel=noopener`, axe-clean)                                                                                                                                                                                                                              |
| reviews     | Implementation **PASS**, Security **PASS** (0 findings — clickable URL doubly gated `^https?://` at schema + render, href React-escaped, `rel="noopener noreferrer nofollow"` hardcoded, own-data-only RLS, type fixed server-side). Impl flagged **1 minor** a11y defect — **fixed** (below). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit; re-run after the a11y fix.                                                                                                                                                                                                                                                                                  |

## Review repair (before merge)

- **CONFIRMED minor — double `aria-current`.** The new `/profile/recommendations`
  nav item is nested under `/profile`; `NavLink`'s active check
  (`pathname === href || startsWith(href + "/")`) matched BOTH on that route →
  two links marked `aria-current="page"`. Fixed: `NavLink` now takes the sibling
  hrefs and applies **most-specific-wins** (a parent defers to a longer matching
  nested href), so exactly one link is current; `/profile/history` &
  `/profile/preferences` (no own nav item) still highlight "Profil & Preuves".
  e2e now asserts exactly one `aria-current` on the recommendations route.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews, then continue with the next ingestion brick.
- **stopReason**: —
