# Product Requirements Document

Status: Draft v0.1  
Product: MissionPilot  
Initial deployment: Single-user private beta  
Target platform: Web, desktop-first and mobile-readable

## 1. Objective

Build a private AI-assisted opportunity intelligence workspace that finds and evaluates full-remote senior freelance design opportunities and prepares truthful application material under human supervision.

## 2. Primary persona

A senior freelance UX, product, service design and transformation professional who:

- has 20+ years of experience;
- works in French and English;
- targets international B2B missions;
- values strategic scope, autonomy and stability;
- requires genuine remote compatibility;
- needs fast, evidence-based prioritization rather than more job-board noise.

## 3. Jobs to be done

- When opportunities are scattered across many sources, help me collect them in one place.
- When a listing claims to be remote, tell me whether I can actually perform it from my chosen country.
- When compensation is unclear, identify the uncertainty and estimate only when evidence supports it.
- When a role looks attractive, compare it with my experience and constraints using explicit evidence.
- When I decide to apply, prepare tailored materials without inventing facts.
- When I accept or reject recommendations, learn what mattered.
- When applications produce outcomes, show which sources, role types and messages perform best.

## 4. MVP user journeys

### Journey A — Profile setup

1. User imports or enters professional profile data.
2. User defines target roles, rate expectations, contract type, locations, time-zone tolerance and hard exclusions.
3. System identifies missing or contradictory fields.
4. User confirms the profile version.

Acceptance criteria:

- every field is editable;
- hard constraints are visibly distinguished from preferences;
- the system stores provenance for imported facts;
- no inferred fact becomes “verified” without user confirmation.

### Journey B — Import opportunity

1. User pastes a URL or listing text.
2. System fetches only when permitted and records the source.
3. Extractor returns structured data with per-field confidence.
4. Normalizer deduplicates against existing records.
5. User sees the opportunity in the inbox.

Acceptance criteria:

- source URL, retrieval date and raw snapshot are retained;
- failed extraction yields a useful recoverable state;
- duplicates are linked, not silently discarded;
- unknown fields remain unknown.

### Journey C — Evaluate opportunity

1. Rules engine checks hard constraints.
2. Matching agent evaluates role, domain, seniority, commercial fit, remote feasibility and evidence coverage.
3. Critic agent challenges unsupported conclusions.
4. Finalizer produces score, verdict, evidence, risks, unknowns and suggested next step.
5. User can accept, reject, save or request a refresh.

Acceptance criteria:

- hard constraint failures are prominent;
- score components are visible;
- every positive claim links to profile or listing evidence;
- confidence is distinct from fit score;
- the final result passes schema validation.

### Journey D — Prepare application

1. User selects an opportunity and application type.
2. System selects relevant verified evidence.
3. Drafting agent prepares a concise positioning summary, tailored CV bullets and cover/recruiter message.
4. Fact-check agent compares all claims against the evidence set.
5. User edits and approves export.

Acceptance criteria:

- unverified claims are blocked or visibly marked;
- user can inspect the evidence behind each generated claim;
- no external message is sent by the MVP;
- generated variants are versioned.

### Journey E — Feedback and learning

1. User provides a reason when rejecting or prioritizing an opportunity.
2. User records application outcome.
3. Ranking preferences update transparently.
4. System can replay historical evaluations against a new profile or scoring version.

Acceptance criteria:

- feedback never overwrites historical runs;
- ranking changes are explainable;
- the user can reset learned preferences;
- offline evaluation compares new and old ranking versions.

## 5. Functional requirements

### P0 — Required for MVP

- authentication for a private user;
- candidate profile editor;
- structured portfolio/evidence library;
- opportunity import from URL and pasted text;
- one or more compliant source adapters;
- normalization and duplicate detection;
- hard constraint policy engine;
- AI match analysis with citations to internal evidence;
- opportunity inbox and detail page;
- shortlist/reject/feedback actions;
- application draft workspace;
- human approval gate;
- durable background workflow execution;
- agent run log and prompt/model versioning;
- unit, integration and end-to-end tests for critical flows;
- basic cost and token usage reporting.

### P1 — After MVP validation

- scheduled source refresh;
- email/recruiter-message ingestion;
- saved searches and alerts;
- compensation normalization across currencies and contract types;
- portfolio case-study recommendation;
- application outcome analytics;
- source quality scoring;
- multi-user tenancy and billing foundations.

### P2 — Later

- recruiter CRM;
- assisted outreach sequences;
- interview preparation agent;
- calendar and email integrations;
- controlled external actions with explicit confirmation;
- reusable vertical workflow plugins.

## 6. Scoring model

The global score must not be a single opaque LLM judgment.

Recommended components:

- hard constraint status: pass / warn / fail;
- role and seniority fit: 0–100;
- experience evidence coverage: 0–100;
- strategic scope fit: 0–100;
- remote and geographic feasibility: 0–100;
- commercial fit: 0–100;
- domain relevance: 0–100;
- application competitiveness: 0–100;
- listing quality and completeness: 0–100;
- confidence: 0–100, reported separately.

Initial weighted score:

- evidence coverage: 25%;
- role/seniority: 20%;
- strategic scope: 15%;
- remote feasibility: 15%;
- commercial fit: 15%;
- domain relevance: 5%;
- competitiveness: 5%.

Rules:

- a hard fail caps the recommendation at “Do not apply” unless the user overrides the constraint;
- missing compensation lowers confidence, not automatically the role fit;
- all weights are configurable and versioned;
- user feedback can propose weight changes but cannot silently apply large changes.

## 7. Non-functional requirements

- responsive interface;
- WCAG 2.2 AA target;
- structured logs and correlation IDs;
- idempotent background operations;
- retry-safe workflows;
- encrypted secrets and least-privilege access;
- EU-friendly data handling and deletion capability;
- provider and model portability;
- deterministic tests where feasible;
- no production dependency added without a documented reason.

## 8. Metrics

North-star metric:

- qualified opportunities accepted by the user per hour of attention.

Supporting metrics:

- percentage of imported opportunities rejected by hard constraints before AI analysis;
- precision of top-10 recommendations;
- user acceptance rate of “strong match” results;
- time from import to reviewed recommendation;
- factual error rate in generated application assets;
- interview conversion by source and score band;
- model cost per qualified opportunity;
- workflow retry and failure rate.

## 9. Risks

- source terms prohibit automated collection;
- remote eligibility is ambiguous;
- compensation estimates can mislead;
- profile evidence may be incomplete;
- LLM scores may drift across versions;
- automation may encourage volume over quality;
- storing CV and application data creates privacy obligations.

Each risk must have a corresponding control in architecture, UX or operations.

## 10. Definition of MVP done

The MVP is done when a user can create a profile, import an opportunity, receive a schema-valid and evidence-backed evaluation, give feedback, generate fact-checked application drafts, inspect the complete run history and deploy the application to Vercel with automated tests passing.
