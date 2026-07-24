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

| Check       | Result                                                                                                                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **174/174 unit** · build                                                                                                                                                                                                                                             |
| unit        | **174** (+5 connector: honest mapping incl. repaired salary swap + EUR/year only with a figure, credential/keyword bounds, typed errors)                                                                                                                                                                        |
| integration | **36** (+2: discovered ad → structured fields + provenance + `import` snapshot under RLS; re-discovery dedupes)                                                                                                                                                                                                 |
| e2e         | **35/35** — keyless CI shows the honest unconfigured note on the inbox                                                                                                                                                                                                                                          |
| reviews     | Security **PASS** (credentials provably never logged; ad content through the audited pipeline; keywords injection-safe; RLS-only writes). Implementation **CHANGES_REQUESTED** → **1 MAJOR + minors confirmed and repaired** (below); re-gated green (176 unit). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit; re-run after the repairs.                                                                                                                                                                                                                                                     |

## Review repairs (before merge)

- **CONFIRMED MAJOR — predicted salaries imported as stated.** Adzuna's
  "Jobsworth" model ESTIMATES a salary for ads that state none
  (`salary_is_predicted`), very common on the fr market — and the connector
  would have persisted those estimates as stated EUR/year compensation, in
  direct violation of the "null = the source did not say" invariant (the
  snapshot contains no salary text to substantiate them). **Fixed:** the flag
  is parsed (string "1" or number 1 — Adzuna serializes both) and the WHOLE
  compensation block is dropped when predicted. Regression test (both
  serializations).
- **Minor — no per-ad error isolation.** One malformed ad voided the whole
  batch (generic error, no refresh, despite committed imports). Fixed: per-ad
  try/catch + honest `failed` count surfaced in the result message (FR/EN
  recomputed from imported/duplicates/failed — failures are no longer
  miscounted as "already known").
- **Minor — merged normalized bypassed the schema.** Now
  `normalizedOpportunitySchema.parse(merged)` fails a bad ad locally instead
  of deep in the RPC.
- **Minor — AND keywords risked empty first runs.** Switched to `what_or`
  (any profile keyword matches).
- **Hardening:** upstream results capped at the requested page size;
  non-http(s) `redirect_url` dropped; `ADZUNA_COUNTRY` regex-tightened.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Activation (Adzuna keys) is the owner's, guided.
- **stopReason**: —
