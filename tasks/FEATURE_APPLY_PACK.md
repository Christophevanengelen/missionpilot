# Feature Task — Apply Pack (Missionhunt)

Origin: `_PROD/missionpilot/MASTER-PLAN — Missionhunt Apply Pack (2026-08-17).md` (Drive), distilled from the manual executive-search campaign of 2026-08-17 (15 targets, 4 CV variants, one tone contract).

## Objective

When the user opens an opportunity, the product proposes which CV variant to send, drafts the message in the user's own tone and language (French or English), and hands over a ready-to-send pack. The product prepares; the human sends — "we never apply on your behalf" stays true at every step.

## What already exists (do not rebuild)

- `ai_application_drafts` — one live tailored draft per (profile, opportunity), grounded in the validated profile, "prepare, don't send";
- opportunity ingestion, matching, tracking and dismissals;
- the loop-engineering development contract and reviewers.

## Gap this feature closes

- CV variants as first-class, owner-scoped user data, and a per-opportunity variant choice with a stated rationale;
- a tone contract (today drafts are French-only with a fixed voice; the user's real campaigns need FR/EN and their own voice rules);
- a ready-to-send pack (subject + body + which CV to attach) the user can copy or export;
- later, spontaneous outreach to recruiters and search firms, where no listing exists.

## Loops

- **L1 — CV variants schema** (done, merged): `cv_variants` table with owner-only RLS (same pattern as `ai_application_drafts`), plus `cv_variant_id` and `cv_variant_rationale` on the live draft. pgTAP suite. No UI.
- **L2 — variant selection in tailoring** (done, merged): the draft workflow picks a variant by quoting each variant's `use_when` rules; the rationale is stored (shown by the L4 pack UI).
- **L3 — tone contract and language** (implemented, pending review/merge): per-profile, versioned voice rules; FR/EN chosen from the opportunity; subject line generation. See `docs/loop-engineering/runs/APPLY-PACK-L3-contrat-de-ton.md`.
- **L4 — ready-to-send pack UI**: draft + subject + chosen variant + copy/export, with approval wording aligned on the loop contract ("sending an application" is always the human's act).
- **L5 — spontaneous outreach mode**: target a firm without a listing; the 2026-08-17 campaign corpus becomes few-shot material.

## Key safety rules

- No invented facts: drafts ground only in the validated profile and the selected variant.
- No autonomous sending, ever (product tenet + loop contract).
- Real CV data enters through the product; dev seeds stay clearly synthetic.

## Acceptance criteria — L1

- migration applies cleanly on a reset local stack;
- RLS: owner-only on every verb for `cv_variants`; creating a variant inside another user's profile is blocked;
- a draft can record which variant it accompanies and why; attaching another profile's variant is blocked by the composite FK;
- deleting a variant clears the draft's reference without touching the draft;
- pgTAP suite covers all of the above; `pnpm typecheck` unaffected.

## Acceptance criteria — L3

- per-profile voice/tone rules stored in their own versioned table, owner-only RLS, never editable by another user's session. **Implemented as a declared deviation from the four-verb (select/insert/update/delete) pattern named above**: `authenticated` gets ONLY select and insert on `tone_contracts` — no update, no delete grant — so append-only versioning is a DATABASE guarantee, not an app-code promise. Flagged for explicit reviewer/founder sign-off in the loop record; the fallback (grant update/delete and rely on app discipline alone) is weaker and was not chosen;
- publishing a new tone-contract version never mutates a past version in place — a draft already generated under an old version keeps citing that version, not silently the newest one;
- language is read from the opportunity itself (its own detected/declared language), never hardcoded to French — an English-language opportunity produces an English draft even when the profile's default is French, and vice versa;
- the drafting workflow generates a subject line alongside the body, grounded in the same evidence and tone contract as the message, not a generic template;
- an anti-cliché/style guardrail rejects or flags stock phrasing (e.g. "passionate self-starter", "je me permets de vous contacter") before a draft is stored, so the tone contract is enforced, not merely suggested;
- a profile with no tone contract yet still drafts correctly: a sane default tone contract applies, and existing FR-only drafts continue to generate exactly as before — no regression, no forced migration;
- pgTAP suite covers the new table's RLS and versioning invariants; `pnpm typecheck` unaffected.

**Explicitly out of scope for L3** (see the loop record): seeding `tone_contracts` with the founder's real 2026-08-17 campaign voice — that corpus is not in this repository and is a human/product follow-up, not something an agent can complete without the source material; persisting a detected-language column on `opportunities` itself (language is computed at draft time only); any UI (still deferred to L4).
