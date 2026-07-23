# Task Loop Record — Phase 2 / PR 1 — Opportunity ingestion (pasted text)

- **schemaVersion**: 1.0
- **taskId**: P2-1-opportunity-ingestion
- **goal**: Open Phase 2's first vertical slice (ROADMAP outcome: "the user
  can import listings and inspect normalized data"). Paste a listing →
  freeze an immutable source snapshot → deterministically normalize it into
  an owned Opportunity → inspect the raw source next to the normalized data.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T01:00:00+02:00
- **startSha**: `30d5525` (main, after Phase 1 fully merged)
- **branch**: `feat/phase-2-opportunity-ingestion`

## Scope (this PR)

Pasted-text import only. URL import + source-policy gate, duplicate-detection
UX beyond per-owner fingerprint, and retry UX are later Phase 2 PRs.

- **Migration** (`20260724010000_phase2_opportunity_ingestion.sql`):
  `opportunities` (canonical, owner-scoped, `unique(profile_id,
canonical_fingerprint)` per-owner dedup, comp-coherence CHECK) +
  `opportunity_snapshots` (IMMUTABLE — no UPDATE grant for any role;
  composite FK to the same profile). Atomic `import_opportunity` SECURITY
  DEFINER RPC (auth.uid()+own-profile FOR UPDATE, create-or-touch canonical
  row + append snapshot); the DB is the sole author of the canonical row.
  No direct insert/update grant on either table for `authenticated`.
- **Domain** (`src/domain/opportunity.ts`): `normalizedOpportunitySchema`
  (Zod mirror of the columns, all fields optional/nullable) +
  `pastedImportSchema` + enums.
- **Extractor** (`src/lib/opportunity/extract.ts`): PURE deterministic,
  rule-based normalization + sha256 `contentHash` + `canonicalFingerprint`.
  Honest `unknowns` list — never guessed. **NOT an LLM**: real model-based
  extraction through the AiProvider abstraction is a later PR. Pasted text
  is DATA, never instructions (prompt-injection boundary, unit-proven).
- **Logic/Action**: `importPastedText`/`list`/`get`/`getLatestSnapshot`
  (session client, RLS); `importPastedTextAction` (DAL + Zod + sanitized).
- **UI**: `/opportunities` (import form + list) + `/opportunities/[id]`
  (read-only inspection: UNVERIFIED banner, normalized fields, undetermined
  fields, frozen source capture). Nav "Opportunities" wired. Copy FR+EN.

## Key safety (SECURITY_AND_COMPLIANCE.md)

Extracted fields are UNVERIFIED assertions from source text — never facts;
the inspection screen says so prominently. Immutable snapshots preserve
provenance. The extractor cannot be steered by the source content.

## Config change (justified)

Integration test files all mutate the same local Supabase DB; running them
concurrently is race-prone (a new file exposed a latent cross-file
row-state race in the pre-existing state-machine test). Set
`fileParallelism: false` for the integration project only — deterministic;
unit/dom projects stay parallel.

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **97/97 unit** · build                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| pgTAP       | **+18** (anon zero access; import creates canonical + frozen snapshot; per-owner dedup appends a 2nd snapshot, no dup row; snapshots immutable — no UPDATE grant; no direct INSERT; DB rejects >50-entry list via the RPC; cross-user isolation; same-fingerprint import targets the caller's own profile)                                                                                                                                                                                                                 |
| unit        | **+9** (deterministic; defensible fields + honest unknowns; opaque text ⇒ all unknown; embedded instructions inert; hash stable/sensitive; fingerprint dedupes case/space variants; reversed range normalized; **no fabricated compensation from a stray/non-money number**)                                                                                                                                                                                                                                               |
| integration | **+4** (round-trip normalize+freeze; dedup appends snapshot; honest unknowns; cross-user reads none) — full suite serial **27/27**                                                                                                                                                                                                                                                                                                                                                                                         |
| e2e         | **32/32** — new: paste → import → inspection (unverified banner + normalized fields scoped + frozen source) → list → dedup on re-import + axe scan                                                                                                                                                                                                                                                                                                                                                                         |
| reviews     | security **PASS** (0 above info; M1 ReDoS in a remote regex — redundant branch removed; M2 DB list bounds — validation trigger added, mirrors Zod, +pgTAP; I3 regex nit fixed). implementation **PASS** (0 blocker; **1 Medium repaired** — compensation now emits only when a figure is money-adjacent, never a stray/experience number, +unit lock; Lows: id-route UUID regex tightened, dead copy keys + unused action fields removed; the verifySession-in-try note is the established house pattern, left consistent) |
| CI          | (to fill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Stop

- **requiresHumanApproval**: yes (merge)
- **stopReason**: —
