# Task Loop Record — APPLY-PACK-L2: variant selection in tailoring

- **schemaVersion**: 1.0
- **taskId**: APPLY-PACK-L2
- **goal**: The tailoring workflow offers the profile's CV variants to the model, stores which variant the draft accompanies and why, and folds the variants into the freshness hash. Backend only — display comes with the L4 pack UI.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt** / **completedAt**: 2026-08-17T18:55:00Z / 2026-08-17T19:55:00Z

## Acceptance criteria

- [x] model offered name/headline/use_when per variant; returns cvVariantName (offered name or null) + cvVariantRationale; prompt bumped to application-tailor-2
- [x] unknown or absent name resolves to "no choice" — null stored, never a guess (resolveChosenVariant, unit-tested)
- [x] variants in the freshness hash; empty list byte-identical to pre-variant hashes (no mass refresh)
- [x] draft persists cv_variant_id + cv_variant_rationale; variant deletion clears both, draft intact (integration-proven through a real RLS session)
- [x] privacy policy counts 22 tables and describes cv_variants, subscriptions, billing_events (the billing rows were main's undeclared debt, folded in deliberately)

## Constraints

- Prepare, don't send. Backend only, no UI caller of tailorApplicationAction exists yet (verified).
- Local environment: linkedin-zip unit test is a load flake (times out in the full parallel run, 7/7 in isolation) — untouched, out of scope.
- account_deletion.test.sql carries 3 failures on this branch caused by main's Polar billing tables — fixed separately in PR #106 (fix/revoke-facturation); merge #106 first.

## Actions (files created/modified)

- `src/lib/matching/ai-tailor.ts` — schema + OfferedCvVariant + instruction (choice, exact echo, abstain case) + prompt v2
- `src/lib/matching/tailor-logic.ts` — loadCvVariants, resolveChosenVariant, StoredDraft/loadDraft/upsertDraft extended
- `src/lib/matching/tailor-actions.ts` — variant load, hash composition, unknown-name warn, persistence
- `src/domain/account.ts` — cv_variants added to PERSONAL_TABLES (art. 20 export)
- `tests/unit/tailor-logic.test.ts` (new, 5) · `tests/integration/application-draft.test.ts` (variant + trigger case)
- `content/legal/politique-de-confidentialite.md` — 22 tables, 3 new rows
- `src/lib/db/database.types.ts` — regenerated (`pnpm db:types`)
- `tasks/FEATURE_APPLY_PACK.md` — L2 wording (display moved to L4)

## Checks

| Check                        | Command                                                           | Result                                                                       |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Typecheck                    | `pnpm typecheck`                                                  | passed                                                                       |
| Unit                         | `pnpm test`                                                       | 771/772 — sole failure = pre-existing linkedin-zip load flake (7/7 isolated) |
| Integration                  | `pnpm test:integration`                                           | 51/51 passed (after `scripts/create-dev-user.ts`)                            |
| RLS                          | `pnpm test:rls`                                                   | cv_variants suite green; 3 pre-existing billing failures → PR #106           |
| Targeted rerun after repairs | `vitest run` (account-export, tailor-logic, ai-tailor, politique) | 23/23 passed                                                                 |

## Evidence

- L1 runtime proof landed with this stack run: `cv_variants_rls.test.sql` green on a reset base.
- The trigger path is proven end-to-end: PostgREST `.delete()` on the variant → FK set-null UPDATE → trigger clears the rationale, letter intact.
- Wire-schema compatibility of the two new required nullable keys verified against the provider layer by the reviewer (same path as cv-ai/ai-trajectory in production).

## Review findings

| Reviewer                | Severity | Finding                                                          | Resolution                                                                  |
| ----------------------- | -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| implementation-reviewer | major    | F1 cv_variants absent from PERSONAL_TABLES (export art. 20)      | fixed (list + self-adjusting test green)                                    |
| implementation-reviewer | minor    | F2 separator-collision comment overstated                        | fixed (assumption stated; enforcement pinned to variant write path)         |
| implementation-reviewer | minor    | F3 echo key not byte-stable (trim/slice vs exact match)          | recorded — normalize names at the variant write path (L4)                   |
| implementation-reviewer | minor    | F4 "null iff" enforced one-way only (rationale ⇒ variant)        | recorded — real invariant documented here; name-without-rationale tolerated |
| implementation-reviewer | minor    | F5 abstain case unspecified in the instruction                   | fixed (abstention explicite plutôt qu'un choix forcé)                       |
| implementation-reviewer | info     | F6 MAX_VARIANTS truncation diverges from hash/resolver           | recorded — warn/comment when >12 variants (none possible today)             |
| implementation-reviewer | info     | F7 policy row tense; section 9 must gain the tailoring row at L4 | fixed (dormante) / pinned to L4                                             |
| implementation-reviewer | info     | F8 loop record + task wording ("shown")                          | fixed (this record; task file reworded)                                     |

Verdict after gate fix: mergeable (reviewer's condition was F1, resolved as prescribed; F3/F4/F6 ride as recorded minors).

## Next action

L3 — tone contract and language (FR/EN + subject line). L4 must pick up: section 9 policy row for the tailoring task, variant-name normalization at the write path, rationale display.

- **requiresHumanApproval**: yes — merge PR #106 first, then PR #105
- **stopReason**: L2 complete with runtime evidence; UI display deliberately deferred to L4
