# Task Loop Record — Phase 4 / PR 5 — Auto-discovery connector (Adzuna)

- **schemaVersion**: 1.0
- **taskId**: P4-5-discovery-adzuna
- **goal**: The last big brick of the owner's vision ("l'app doit montrer des
  matchs qui arrivent seuls"): a LEGAL auto-discovery connector. One click →
  search Adzuna (official free API) with keywords from the CONFIRMED profile →
  every ad flows through the standard pipeline (immutable snapshot, per-owner
  dedup, gate + score on read) → the filterable inbox fills itself.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T15:00:00+02:00
- **startSha**: `358776a` (main, after Phase 4 PR 4)
- **branch**: `feat/phase-4-discovery-adzuna`

## Owner decisions (recorded)

- Discovery from **legal sources only** (owner confirmed the approach); no
  scraping of ToS-protected boards — Adzuna is an aggregator with an OFFICIAL
  API, permissive by construction.
- Activation = owner registers free keys at developer.adzuna.com and sets
  `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (+ optional `ADZUNA_COUNTRY`, default
  `fr`) — same graceful pattern as the OpenAI adapter; the keys are never
  handled by the assistant.

## Scope (NO migration — `retrieval_method='import'` existed since Phase 2)

- **`src/lib/discovery/adzuna.ts`** (server-only): zod-validated search,
  honest mapping (null = the source did not say): contract_type
  permanent/contract → permanent/interim; salaries are ANNUAL (period `year`),
  currency EUR only for the `fr` market; swapped min/max repaired; verbatim
  ad text (bounded 100k) becomes the immutable snapshot. Credentials only in
  the request URL to api.adzuna.com; never logged (status-only logs). 15s
  timeout, 10 results/page, keywords capped at 5.
- **`logic.importDiscovered`**: structured API fields take precedence over the
  deterministic extractor (bounded defensively); the compensation block is
  taken WHOLE from one side (never mixing an API figure with an extractor
  currency/period). `runImport` gained an optional prepared-extraction param.
- **`discoverOpportunitiesAction`**: verifySession → configured? → keywords
  from CONFIRMED role + skills (max 4; none ⇒ honest "confirm your profile
  first") → search → import each → `{found, imported, duplicates}`.
- **UI**: a "Découvrir des offres" button on the inbox with honest result /
  error messages; when unconfigured, an explanatory note instead of a dead
  button. Copy FR+EN.

## Key safety

- Ad content is untrusted DATA through the same pipeline as pasted imports
  (snapshot, extractor, gate, score — no new trust granted). RLS owner-only.
  Credentials never logged; no scraping; no migration; no LLM.

## Checks (evidence)

| Check       | Result                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **174/174 unit** · build                                                                      |
| unit        | **174** (+5 connector: honest mapping incl. repaired salary swap + EUR/year only with a figure, credential/keyword bounds, typed errors) |
| integration | **36** (+2: discovered ad → structured fields + provenance + `import` snapshot under RLS; re-discovery dedupes)                          |
| e2e         | **35/35** — keyless CI shows the honest unconfigured note on the inbox                                                                   |
| reviews     | (to fill after independent passes)                                                                                                       |
| CI          | (to fill after push)                                                                                                                     |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Activation (Adzuna keys) is the owner's, guided.
- **stopReason**: —
