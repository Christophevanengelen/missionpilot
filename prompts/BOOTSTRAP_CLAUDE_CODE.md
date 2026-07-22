# First prompt for Claude Code

Open a terminal at the root of this folder, start Claude Code, then paste:

```text
Read CLAUDE.md and every document in its required reading order. Then inspect the entire starter folder.

We are beginning Phase 0 only. Do not create or modify application files yet.

Produce a concrete bootstrap plan for tasks/PHASE_0_BOOTSTRAP.md. Include:
- exact initialization commands;
- proposed versions or version-selection strategy;
- every production and development dependency with a one-line justification;
- final repository tree;
- Supabase local/staging/production approach;
- Inngest local and Vercel integration approach;
- AI provider abstraction design;
- environment variables;
- initial database tables and RLS strategy;
- test, lint, typecheck and build commands;
- CI and Vercel deployment plan;
- security and prompt-injection controls;
- assumptions, risks and decisions that require my approval.

Keep the first implementation milestone small: authenticated application shell, database connectivity, durable workflow hello-world, mocked AI adapter, quality gates and deployable build.

Wait for my explicit approval before executing commands or writing the scaffold.
```
