# ADR 0002 — Human-supervised external actions

Status: Accepted

## Context

Automated job applications and recruiter outreach create reputational, legal and factual risks. Early model reliability is not yet measured.

## Decision

The MVP may discover, analyze and draft, but it will not submit applications, send messages or contact third parties.

## Consequences

- approval UX is required;
- application assets can be copied/exported;
- future integrations must implement explicit confirmation, audit and idempotency;
- product success is measured by quality, not volume of autonomous submissions.
