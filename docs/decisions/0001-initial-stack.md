# ADR 0001 — Initial application stack

Status: Proposed

## Context

The product needs a fast private MVP, server-rendered authenticated UI, structured relational data, private document storage, durable AI workflows and simple deployment.

## Decision

Use:

- Next.js App Router + TypeScript;
- Vercel for the web deployment;
- Supabase for Postgres, Auth and Storage;
- Inngest for durable multi-step workflows;
- provider-neutral AI adapters;
- Zod, Vitest and Playwright.

## Consequences

Positive:

- cohesive TypeScript stack;
- strong local development support;
- preview deployments;
- relational auditability;
- durable retries and step visibility.

Negative:

- several managed services;
- environment coordination is required;
- serverless and workflow limits must be understood;
- migration away from providers requires discipline.

## Alternatives considered

- Vercel Cron only: insufficient as the primary engine for multi-step, retryable AI workflows.
- custom queue and workers: too much operational overhead for the MVP.
- a single monolithic AI route: poor reliability and observability.
