# Task Backlog — Premium Launch (Missionhunt)

Origin: founder-approved product/monetization master plan roadmap (2026-08-21), shared with the founder but not yet represented as repo task files beyond Apply Pack L1–L2. This file distills phases 3–8 of that plan into loop-sized tasks.

This file complements — it never replaces — `tasks/FEATURE_APPLY_PACK.md` and `ROADMAP.md`. Phase 0 (nettoyage: PR #104, PR #8, quarantine of the local duplicate clone) is handled outside the repo. Phase 1 (L3, tone contract) and Phase 2 (L4, apply-pack UI) already live as loops inside `FEATURE_APPLY_PACK.md` — this backlog picks up immediately after them, at Phase 3.

## Loops

- **Phase 3 — garde-fous de production**: Sentry (or equivalent), AI rate limiting, and real per-call cost capture, so the product can carry real usage without flying blind.
- **Phase 4 — système de crédits**: a credit ledger, atomic debit, real Polar integration, and a public pricing page — the monetization mechanics.
- **Phase 5 — conformité légale worldwide**: OpenAI's contractual status, staging/prod separation, worldwide CGU, EU AI Act posture, DPIA, right of withdrawal.
- **Phase 6 — extension Chrome**: real localisation code (today's is placeholder-free because nothing exists yet), dogfooding, Chrome Web Store listing.
- **Phase 7 — onboarding et polish premium**: a first-run experience and visual polish worthy of a paying user, built on top of Phase 4's plans/credits.
- **Phase 8 — répétition générale et lancement**: a full dry run of the paid product end to end, then launch.

## Key safety rules

- No loop below starts from a blank guess: "what already exists" was produced by grepping this repo (2026-08-21), not assumed from the roadmap prose.
- Items marked **founder decision required** are not this backlog's to resolve — a loop reaching one stops and asks, it does not pick a default and proceed.
- Nothing here overrides the Apply Pack's tenets (no invented facts, no autonomous sending) — Phase 7's premium polish still respects "the product prepares, the human sends."

## Acceptance criteria — Phase 3 (garde-fous de production)

Objective: the product fails loudly instead of silently once real users and real API spend are on the line.

What already exists:

- structured logging with correlation IDs (`src/lib/observability/logger.ts`, used through `agent-ops.ts`) — a foundation these guardrails can attach to;
- `agent_steps.estimated_cost` (numeric(12,6), default 0) is already a persisted column, and `src/lib/ai/openai-provider.ts` already computes `estimatedCost` from `prompt_tokens` / `completion_tokens` returned by the API against a static internal price table. This is an **estimate derived from token counts**, not a captured real cost from the provider's billing/invoice — "capture réelle du coût par appel" is not yet true, only its precondition (token counts are already read) is;
- `diagnostics` page (`src/app/(dashboard)/diagnostics/page.tsx`) lists `agent_runs`/`agent_steps` per user but does not aggregate or surface cost — no cost dashboard exists;
- no Sentry or equivalent: zero references in the repo, not in `package.json`, not imported anywhere;
- no rate limiting: no middleware, no rate-limit library, no per-user or per-route throttle found anywhere in `src/`.

Stub acceptance criteria:

- error tracking (Sentry or equivalent) captures unhandled exceptions from both the Next.js app and Inngest workflows, tagged with correlation ID and user ID where available, without leaking CV/profile content into error payloads;
- an AI rate limit exists per user and per route (at minimum: opportunity tailoring, CV parsing) with a clear, tested 429 path and no silent drop;
- per-call cost moves from "estimated from a static price table" to "reconciled against the provider's actual reported usage/cost" wherever the provider exposes it, with the estimate kept as a documented fallback, not silently presented as fact;
- the diagnostics page (or a successor) surfaces aggregate cost per user/period, not just per-run traces;
- pgTAP/unit coverage proves the rate limiter cannot be bypassed by retrying a failed request;
- **founder decision required**: vendor and budget for error tracking (self-hosted vs. SaaS, and which SaaS) and for rate limiting (e.g. a paid provider vs. self-built) — not this backlog's to pick.

## Acceptance criteria — Phase 4 (système de crédits)

Objective: users can buy and spend credits, with the ledger as the single source of truth for balance.

What already exists:

- **no credits ledger table exists.** `src/lib/discovery/credits.ts` is unrelated and must not be confused with it: it renders source-attribution credit lines required by job-board partners (e.g. "Jobs by Adzuna"), not a user billing ledger;
- billing infrastructure exists but is **subscription-shaped, not credit-shaped**: `supabase/migrations/20260803180000_facturation_polar.sql` created `subscriptions` and `billing_events` tables; `src/lib/billing/polar.ts` implements Polar (Merchant of Record) checkout creation and standard-webhooks HMAC verification; `src/app/api/billing/checkout/route.ts` and `src/app/api/billing/webhook/polar/route.ts` wire it end to end, idempotent via a `(source, event_id)` unique constraint on `billing_events`, monotonic via `version_timestamp` on `subscriptions`;
- this billing path is **dormant by construction**: both routes 503 (`paymentNotConfigured`) until `POLAR_ACCESS_TOKEN` and a product ID env var are set — it can ship to production before any real Polar product exists;
- a prior grants bug on the billing tables was fixed in `20260817203000_revoke_facturation.sql` (referenced in the L2 loop record as "main's Polar billing tables", fixed in PR #106) — this history matters because Phase 4 will extend the same tables/pattern, not start clean;
- no pricing page exists anywhere in `src/`.

Stub acceptance criteria:

- a `credits_ledger` (or equivalent) table records every grant and every debit as an append-only row, owner-scoped RLS, with a running balance derivable from the ledger (not a separately mutable counter that can drift);
- debit is atomic: two concurrent spends never both succeed past a zero balance (row-level lock or equivalent, proven by a concurrency test);
- the existing Polar checkout/webhook path is extended (or a parallel credit-purchase path is added) to grant ledger credits on a real `checkout.updated`/`order` event, reusing the existing idempotency claim on `billing_events`;
- a public pricing page states what a credit costs and what it buys, in plain language, consistent with the CGU's "the service is free" line being retired (see Phase 5 — that line needs updating the moment billing goes live, in either phase);
- pgTAP suite covers ledger RLS and the atomic-debit guarantee, matching the `cv_variants` RLS pattern for rigor;
- **founder decision required**: whether the monetization shape stays subscriptions (already scaffolded), moves fully to credits, or runs both — the master plan says "crédits" but the repo currently has a working subscriptions skeleton; pricing/bundle amounts are also the founder's to set, not inferred from the code.

## Acceptance criteria — Phase 5 (conformité légale worldwide)

Objective: the legal and compliance surface catches up to a paid, internationally-reachable product.

What already exists:

- `content/legal/conditions-generales.md` (119 lines, v1.0, dated 27 juillet 2026) and `content/legal/politique-de-confidentialite.md` (521 lines) already exist and are substantive — this is not a blank page;
- both are scoped to Belgium/EU: the CGU names the legal entity (Productions Associées ASBL/VZW, BE 0896.755.397), sets Brussels as the competent jurisdiction, and the privacy policy cites GDPR articles 78/79; there is no worldwide/multi-jurisdiction handling;
- the CGU states plainly "le service est gratuit" — this sentence goes stale the moment Phase 4 ships any paid credits or subscription, in either order;
- OpenAI is disclosed as a processor in one sentence in the CGU ("le texte de votre CV est transmis entier à OpenAI... société établie aux États-Unis") — no DPA/SCC/sub-processor detail is evidenced in the repo beyond that disclosure;
- no droit de rétractation (right of withdrawal) section found in either legal document — grepped, absent;
- no EU AI Act or DPIA mention anywhere in the repo — grepped, absent;
- staging/prod separation is **described as intent, not implemented**: `ARCHITECTURE.md` lists "Supabase environments for local, preview/staging and production" as a target, but `.env.example` carries a single `APP_ENV=local` and no second Supabase project configuration exists in the repo.

Stub acceptance criteria:

- CGU and privacy policy are extended to a worldwide-reachable posture (or explicitly geofenced, if that is the founder's chosen sequencing) with a droit de rétractation section appropriate to a paid digital service;
- OpenAI's contractual status (DPA, standard contractual clauses, sub-processor disclosure) is documented and linked from the privacy policy, not just narrated in one sentence;
- staging and production are actually separated (distinct Supabase projects/env vars), closing the gap between `ARCHITECTURE.md`'s stated intent and the single-environment reality;
- an EU AI Act classification exercise is recorded (even if the answer is "limited-risk, no further obligation") — currently there is no artifact of this analysis anywhere in the repo;
- a DPIA is drafted for the CV/profile-data processing path, given OpenAI already receives full CV text;
- **founder decision required, explicitly** — none of the following are this backlog's to resolve: budget légal (whether and how much to spend on outside counsel/review), choix du statut EU AI Act (which regime the product claims — provider, deployer, or exempt — and on what basis), séquencement worldwide (which countries/languages get worldwide CGU coverage first, and in what order). A loop reaching one of these stops and asks.

## Acceptance criteria — Phase 6 (extension Chrome)

Objective: a working Chrome extension that dogfoods the product's own opportunity-capture flow, ready for Web Store listing.

What already exists:

- **nothing.** Grepped for `manifest.json`, `chrome`, `extension` across the repo (excluding build output) — zero matches. This phase is greenfield inside this repo, unlike Phases 3–5 which all have some partial scaffolding to build on.

Stub acceptance criteria:

- extension manifest (MV3) and minimal capture flow: user on a job listing page can send it into MissionPilot's opportunity ingestion, reusing the existing pasted-text/URL import path rather than inventing a second one;
- the extension's own code (not a stub/mock) performs the real localisation of the captured listing before hand-off — "localisation code réel" per the master plan, i.e. no placeholder left where real detection logic belongs;
- dogfooding: the founder uses the extension on at least one real session before Web Store submission, and findings are recorded (loop-engineering run style, same as `APPLY-PACK-L1`/`L2`);
- Chrome Web Store listing assets (description, screenshots, privacy disclosures matching the CGU/privacy policy) are prepared and internally reviewed before submission;
- this phase can start in parallel with Phase 4/5 — it has no schema or legal dependency on either (see Sequencing).

## Acceptance criteria — Phase 7 (onboarding et polish premium)

Objective: a first-run experience and visual finish that feel like a paid product, not a beta shell.

What already exists:

- a profile onboarding flow already exists (`src/app/(dashboard)/dashboard/onboarding-start.tsx`, `src/lib/profile/onboarding.ts`) — this is the _candidate profile_ onboarding from ROADMAP Phase 1, not a premium/paid-plan onboarding; the two are related but not the same thing, and this loop should extend rather than duplicate it;
- no plan-aware or credit-aware onboarding step exists, because Phase 4's ledger/plans don't exist yet — this phase is sequenced after Phase 4 by necessity, not preference.

Stub acceptance criteria:

- first-run flow for a paying user explains what credits/plan they have and what actions consume them, sourced from the real ledger (Phase 4), not hardcoded copy;
- visual polish pass covers the surfaces a paying user sees most: dashboard, apply-pack UI (L4), billing/pricing;
- empty and low-credit states are designed deliberately, not left as raw error states;
- no dark patterns: upgrade prompts are honest about what a credit buys, consistent with the product's "prepare, don't send" / no-invented-facts tenets carried over from the Apply Pack.

## Acceptance criteria — Phase 8 (répétition générale et lancement)

Objective: one full, deliberate dry run of the paid product end to end, then a launch the founder has explicitly signed off on.

What already exists:

- no launch checklist or dry-run record exists in the repo yet — this phase has no scaffolding because every phase it depends on (3 through 7) has to land first.

Stub acceptance criteria:

- a written dry-run script exercises signup, profile setup, opportunity import, matching, apply-pack generation, a real credit purchase and spend, and account deletion, on a close-to-production environment;
- every guardrail from Phase 3 (error tracking, rate limiting, cost capture) is confirmed live and alerting before launch traffic, not just merged;
- every legal artifact from Phase 5 is confirmed published and dated, not just drafted;
- **founder decision required**: the go/no-go call and the launch date itself — this backlog can confirm readiness, it cannot declare launch.

## Sequencing

L3 → L4 → garde-fous (Phase 3) → crédits (Phase 4) → légal (Phase 5) — extension Chrome (Phase 6) can run in parallel starting now, since it has no schema or legal dependency on the others → onboarding (Phase 7), which needs Phase 4's ledger/plans to exist → répétition générale et lancement (Phase 8), which needs everything above.
