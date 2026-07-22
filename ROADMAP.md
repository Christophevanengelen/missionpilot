# Roadmap

## Phase 0 — Foundation

Outcome: a deployable empty product shell with authentication, database migrations, tests, observability and CI.

Deliverables:

- Next.js application scaffold;
- design tokens and basic shell;
- Supabase local setup and authenticated session;
- RLS-tested base schema;
- Inngest local development endpoint;
- AI provider interface with mocked adapter;
- lint, formatting, typecheck, unit and Playwright setup;
- Vercel-compatible build;
- environment documentation.

## Phase 1 — Profile and evidence

Outcome: the user can create a versioned candidate profile and evidence library.

Deliverables:

- profile onboarding;
- target preferences and hard constraints;
- evidence CRUD with provenance;
- profile completeness checks;
- profile version publishing;
- synthetic seed profile for development.

## Phase 2 — Opportunity ingestion

Outcome: the user can import listings and inspect normalized data.

Deliverables:

- pasted text import;
- public URL import with source policy gate;
- immutable snapshots;
- extraction schema;
- normalization;
- duplicate detection;
- import status and retry UX.

## Phase 3 — Matching loop

Outcome: every imported opportunity receives an evidence-backed recommendation.

Deliverables:

- hard constraint engine;
- evidence retrieval;
- match, critique and repair workflow;
- component scores and confidence;
- evaluation fixtures;
- opportunity inbox and detail page.

## Phase 4 — Application workspace

Outcome: the user can generate and edit truthful tailored application assets.

Deliverables:

- evidence selection;
- positioning summary;
- tailored CV bullet suggestions;
- recruiter/cover message;
- claim-level fact checking;
- export/copy functions;
- approval state without external sending.

## Phase 5 — Feedback and analytics

Outcome: the product improves ranking from explicit user decisions and recorded outcomes.

Deliverables:

- reject/shortlist reasons;
- application outcome tracking;
- ranking experiments;
- source and score analytics;
- model cost dashboard;
- evaluation comparison between versions.

## Phase 6 — Controlled automation

Only after measured reliability:

- scheduled compliant source adapters;
- alerts;
- approved email/calendar integrations;
- explicit confirmation for external actions;
- multi-user architecture and commercial validation.
