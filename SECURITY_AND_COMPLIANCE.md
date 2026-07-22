# Security and Compliance

## Threat model summary

MissionPilot handles professional profiles, CV material, application history, imported web content and model-generated analysis. Main risks include unauthorized access, secret leakage, prompt injection, inaccurate generated claims, source-policy violations and accidental external actions.

## Data classification

### Sensitive private data

- CV and profile details;
- contact details;
- application drafts and outcomes;
- recruiter messages;
- private portfolio material;
- API credentials.

### Internal operational data

- prompts;
- scores;
- agent traces;
- source configurations;
- evaluation results.

### Public or externally sourced data

- public job listings;
- public company information;
- public documentation.

Public source content must still be treated as untrusted input.

## Required controls

### Authentication and authorization

- authenticated access for all private routes;
- RLS on every user-owned table;
- server-side authorization checks for mutations;
- no reliance on hidden UI controls for security.

### Secrets

- secrets only in local `.env.local` and deployment secret stores;
- never use `NEXT_PUBLIC_` for private keys;
- never log complete secrets;
- rotate credentials after suspected exposure.

### Prompt injection

- wrap source content as data, never as instructions;
- system prompts explicitly reject instructions embedded in listings;
- tool permissions are defined by server code, not model text;
- extracted URLs and HTML are sanitized;
- external content cannot trigger sending, deployment or filesystem actions.

### Generated claims

- every application claim must reference one or more verified evidence IDs;
- fact-checking occurs after generation;
- unsupported claims block approval;
- user edits are stored separately from model output.

### Source compliance

Before enabling an automated connector, document:

- retrieval method;
- terms/robots review date;
- authentication and license;
- rate limits;
- storage and deletion requirements.

Do not automate restricted sources without explicit authorization.

### External actions

The MVP never sends applications or messages. Future actions require:

- preview of exact payload;
- explicit user confirmation;
- idempotency key;
- audit event;
- recoverable failure state.

### Privacy operations

- export user data;
- delete account and associated private data;
- configurable retention for raw snapshots and logs;
- redact sensitive content from diagnostics;
- document AI provider data-processing settings.

## Security acceptance gate

No production deployment until:

- RLS policies have automated tests;
- private routes reject anonymous access;
- service-role keys are server-only;
- imported HTML is sanitized;
- prompt-injection fixtures are included;
- logs are checked for personal data and secrets;
- deletion/export behavior is documented.
