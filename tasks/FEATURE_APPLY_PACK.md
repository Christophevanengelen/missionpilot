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

- **L1 — CV variants schema** (this loop): `cv_variants` table with owner-only RLS (same pattern as `ai_application_drafts`), plus `cv_variant_id` and `cv_variant_rationale` on the live draft. pgTAP suite. No UI.
- **L2 — variant selection in tailoring**: the draft workflow picks a variant by quoting each variant's `use_when` rules; the rationale is stored (shown by the L4 pack UI).
- **L3 — tone contract and language**: per-profile, versioned voice rules; FR/EN chosen from the opportunity; subject line generation.
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
