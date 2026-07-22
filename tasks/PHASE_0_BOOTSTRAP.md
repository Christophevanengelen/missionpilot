# Phase 0 Task — Bootstrap the foundation

## Objective

Create a production-compatible application foundation that proves the selected stack works locally and can be deployed, without implementing the business features yet.

## Required deliverables

### Application

- initialize Next.js App Router with TypeScript strict mode;
- configure Tailwind and a minimal accessible application shell;
- create authenticated and unauthenticated route groups;
- add a simple protected dashboard page;
- add clear loading, empty and error states.

### Data

- configure Supabase local development;
- create initial migrations for user profile ownership and operational run records;
- enable RLS;
- add automated authorization tests or a documented executable test harness;
- add typed database access.

### Workflows

- configure Inngest locally;
- implement one durable “system health” workflow with multiple steps and idempotency;
- expose status in a protected diagnostics page;
- ensure retries do not duplicate records.

### AI abstraction

- define provider-neutral request/response interfaces;
- implement a mock provider used by automated tests;
- add placeholder server-only adapters without requiring live API calls;
- validate structured output with Zod;
- record latency, provider, model and usage metadata.

### Quality

- formatting;
- linting;
- type checking;
- unit tests;
- one Playwright smoke test;
- production build;
- pre-commit or CI quality gate, avoiding unnecessary tooling.

### Operations

- `.env.example` and environment validation;
- structured logging with correlation IDs;
- sanitized errors;
- README setup instructions;
- Vercel deployment instructions;
- CI workflow proposal or implementation after approval.

## Acceptance criteria

- a new developer can follow documented steps from clone to local app;
- anonymous users cannot access the dashboard;
- authenticated user sees the protected shell;
- database ownership policies are tested;
- the health workflow completes and is observable;
- repeated workflow triggers with the same idempotency key do not duplicate the result;
- mock AI structured output passes validation;
- invalid AI output produces a controlled error;
- no secret is exposed in client bundles or committed files;
- lint, typecheck, tests and build pass;
- the app is ready for a Vercel preview deployment.

## Out of scope

- real opportunity ingestion;
- real matching prompts;
- automatic source crawling;
- payment/billing;
- email or calendar integration;
- external application submission;
- production AI calls unless explicitly approved.

## Approval gate

Before implementation, the coding agent must present the complete bootstrap plan described in `CLAUDE.md` or `AGENTS.md` and wait for approval.
