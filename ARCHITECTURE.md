# Architecture

## 1. Architecture goals

- simple enough for a single-user MVP;
- structured enough to evolve into a multi-tenant product;
- durable and observable AI workflows;
- explicit contracts between deterministic code and model-generated output;
- provider portability;
- secure handling of professional and application data.

## 2. Proposed stack

### Web application

- Next.js App Router
- TypeScript in strict mode
- React Server Components by default
- Tailwind CSS
- shadcn/ui components copied into the repository
- Server Actions only where their security and caching behavior is understood
- Route Handlers for explicit API endpoints and webhooks

### Data and identity

- Supabase Postgres
- Supabase Auth using server-side cookies
- Supabase Storage for CVs, portfolio exports and raw source snapshots
- Row Level Security enabled from the first migration
- SQL migrations committed to the repository

### Durable workflows

- Inngest for source refresh, extraction, matching, critique, drafting and evaluation workflows
- every step has a stable idempotency key;
- retries must resume from the last successful step;
- workflow status is mirrored into the application database for user visibility.

### AI layer

- provider-neutral interface in `src/lib/ai`;
- initial adapters for OpenAI and Anthropic;
- Zod schemas for every structured output;
- prompt templates stored as versioned code or text assets;
- deterministic rules before model calls;
- model calls wrapped with cost, latency, trace and retry metadata;
- no model name hard-coded outside provider configuration.

### Testing

- Vitest for domain logic, contracts and adapters;
- MSW or equivalent request mocking for external providers;
- Playwright for onboarding, import, evaluation and draft approval;
- prompt/evaluation fixtures for regression testing;
- database integration tests against a disposable local Supabase instance where practical.

### Deployment

- Vercel preview deployment for each pull request;
- Vercel production deployment from the protected main branch;
- Supabase environments for local, preview/staging and production;
- Inngest environments aligned with application environments;
- secrets stored only in platform environment settings and `.env.local` locally.

## 3. Suggested repository structure

```text
missionpilot/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── opportunities/
│   │   ├── applications/
│   │   ├── profile/
│   │   ├── runs/
│   │   └── settings/
│   └── api/
│       ├── inngest/
│       ├── imports/
│       └── webhooks/
├── src/
│   ├── components/
│   ├── features/
│   │   ├── profile/
│   │   ├── evidence/
│   │   ├── opportunities/
│   │   ├── matching/
│   │   ├── applications/
│   │   └── feedback/
│   ├── lib/
│   │   ├── ai/
│   │   ├── db/
│   │   ├── auth/
│   │   ├── observability/
│   │   └── security/
│   ├── workflows/
│   └── domain/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── fixtures/
│   ├── integration/
│   ├── e2e/
│   └── evals/
├── prompts/
├── docs/
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

Do not create this structure blindly. The coding agent must first present a concrete Phase 0 plan and explain any proposed deviation.

## 4. Domain modules

### Profile

Owns verified professional facts, target preferences, hard constraints and profile versions.

### Evidence

Stores atomic evidence units such as achievement, responsibility, metric, domain, skill, case-study reference and provenance.

### Opportunity

Owns raw snapshots, normalized job fields, duplicate links, source metadata and lifecycle state.

### Policy

Evaluates deterministic constraints such as location, contract type, minimum compensation, travel and time-zone overlap.

### Matching

Produces component scores, evidence mappings, risks, unknowns and recommendation.

### Application

Produces versioned, fact-checked assets but performs no external send in the MVP.

### Feedback

Stores explicit decisions, reasons and outcomes without mutating historical records.

### Agent operations

Stores runs, steps, prompt versions, models, token/cost metadata, validation results and evaluations.

## 5. Core workflow

```text
source input
  -> permission/source policy check
  -> fetch or accept pasted content
  -> persist immutable raw snapshot
  -> extract structured fields
  -> schema validation
  -> normalize
  -> deduplicate
  -> deterministic hard-constraint evaluation
  -> stop early on hard fail when configured
  -> retrieve candidate evidence
  -> primary match analysis
  -> adversarial critique
  -> repair/finalization
  -> automated graders
  -> persist recommendation and run trace
  -> notify UI
  -> collect human feedback
```

## 6. Loop engineering protocol

This section defines the **product runtime loop** (MissionPilot's AI workflows). The **development loop** — how coding agents work on this repository — is defined separately in `docs/loop-engineering/LOOP_CONTRACT.md`; the two have different repair limits on purpose.

Every non-trivial AI workflow follows this loop:

1. **Specify** — define input, output schema, policy and success criteria.
2. **Plan** — create a step plan and identify failure modes.
3. **Execute** — perform deterministic work and model calls.
4. **Validate** — parse schema, verify citations and check invariants.
5. **Critique** — run an independent critique prompt or deterministic grader.
6. **Repair** — correct only identified defects.
7. **Evaluate** — assign quality metrics and compare thresholds.
8. **Escalate or finalize** — request human review when confidence is low.
9. **Record** — persist trace, versions, costs and outcome.
10. **Learn** — incorporate explicit feedback into future ranked decisions.

Maximum repair loops must be bounded to control cost and avoid infinite retries.

## 7. Data model overview

Core tables:

- `users`
- `candidate_profiles`
- `profile_versions`
- `preferences`
- `evidence_items`
- `source_connectors`
- `source_runs`
- `opportunities`
- `opportunity_snapshots`
- `opportunity_duplicates`
- `policy_results`
- `match_analyses`
- `match_evidence_links`
- `application_projects`
- `application_assets`
- `feedback_events`
- `application_outcomes`
- `agent_runs`
- `agent_steps`
- `prompt_versions`
- `evaluation_results`
- `audit_events`

Detailed contracts are in `docs/DOMAIN_MODEL.md` and `schemas/`.

## 8. Source adapter policy

Each source adapter declares:

- source name and type;
- permitted retrieval mechanism;
- authentication method;
- rate limits;
- robots/terms review status;
- fields available;
- refresh interval;
- data retention rules;
- parser version.

Initial safe adapters should prioritize:

- user-pasted listing text;
- user-provided URLs to public pages;
- RSS/Atom feeds;
- documented public or licensed APIs;
- structured job feeds supplied by companies.

LinkedIn or other restricted platforms must not be scraped. User-provided exports or messages can be ingested only through a compliant method.

## 9. Security boundaries

- browser never receives provider secret keys;
- all model calls occur server-side;
- raw documents are private by default;
- RLS protects every user-owned row;
- signed URLs expire;
- imported HTML is treated as untrusted;
- prompt injection defenses separate source content from system instructions;
- external content cannot authorize tools or actions;
- audit logs record sensitive actions without logging secret values.

## 10. Decisions intentionally deferred

- exact AI model selection;
- multi-tenancy and billing;
- vector database choice;
- browser automation;
- automatic application submission;
- recruiter outreach;
- advanced compensation estimation.

These decisions require evidence from MVP usage.
