# First prompt for Codex

Open the folder in Codex or run Codex from its root. Use plan mode and paste:

```text
Read AGENTS.md and all mandatory context files. Inspect the entire starter folder.

Plan Phase 0 from tasks/PHASE_0_BOOTSTRAP.md, but do not modify files or run initialization commands yet.

Your plan must include exact commands, dependencies with reasons, repository structure, environment variables, Supabase/RLS migrations, Inngest integration, provider-neutral AI interface, test strategy, CI, Vercel deployment, security controls, acceptance criteria and verification commands.

The first vertical slice must be intentionally small: authenticated shell, database connection, one durable test workflow, mocked AI adapter, observability foundation and a production-compatible build.

Call out every assumption and architectural deviation. Wait for approval before implementation.
```
