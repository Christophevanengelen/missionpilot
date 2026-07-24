# MissionPilot

MissionPilot is an AI-assisted opportunity intelligence platform for senior freelancers and remote professionals.

Its first mission is to continuously discover, normalize, evaluate and prioritize high-value remote jobs and freelance missions, then prepare evidence-based application material under human supervision.

> **Project status — read this first.**
> This repository has completed **Phase 0 (technical foundation)**: a solid,
> tested base — authentication, database with Row Level Security, one durable
> workflow, a mocked AI layer, quality gates and CI — but **no business
> feature yet**. Per the independent Codex review, accepted by the product
> owner: _the foundation is solid, but the business product is not yet
> functional_. Phase 0 is **not** an end-user MVP. Opportunity import,
> matching and application drafting arrive in Phases 1-4 (`ROADMAP.md`).
> Phase 1 is blocked until J7 is closed and approved.

## Product promise

MissionPilot should answer five questions reliably:

1. Which opportunities are genuinely compatible with my constraints?
2. Why is each opportunity a strong or weak match?
3. Which evidence from my experience supports the match?
4. What should I change in my positioning or application?
5. What did the system learn from my decisions and outcomes?

The MVP will **not**: bypass access controls or scrape sources against their
terms; fabricate experience or credentials; submit an application, contact a
recruiter or send an email without explicit approval; make irreversible
decisions autonomously. (Full boundaries: `VISION.md`, `PRD.md`.)

## Documentation map

`VISION.md` · `PRD.md` · `ARCHITECTURE.md` · `ENGINEERING_PRINCIPLES.md` ·
`SECURITY_AND_COMPLIANCE.md` · `docs/` (domain model, workflows, UX,
evaluation) · `docs/loop-engineering/` (development-loop contract and
per-milestone records) · `tasks/` (phase specs) · agent contracts:
`CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex).

## Approved deviations (Phase 0)

Decisions explicitly approved by the product owner that differ from older
documents in this repository:

- **Radix UI** primitives (`shadcn init -b radix`), not Base UI.
- **Mock AI provider only** — no OpenAI/Anthropic adapter or skeleton exists
  (contrary to `tasks/PHASE_0_BOOTSTRAP.md` "placeholder adapters"); real
  adapters arrive with the first real use case.
- **JSON logger without an OpenTelemetry backend** — structured logs with
  correlation ids; an OTel SDK is added when a telemetry backend exists.
- **System font stack** — no `next/font/google`, no downloaded fonts: the
  build and the shell need **no network access** after `pnpm install`.
- Supabase **new API keys** (`sb_publishable_…`/`sb_secret_…`); legacy
  anon/service_role names are not used anywhere.

---

# Running MissionPilot locally

Written so that a non-developer, assisted by Claude Code or Codex, can
operate the project. Commands are exact; run them from the repository root.

## 1. Prerequisites (one-time)

| Tool           | Why                                        | Check                    | Install if missing                                     |
| -------------- | ------------------------------------------ | ------------------------ | ------------------------------------------------------ |
| Docker Desktop | runs the local Supabase stack              | `docker info`            | docker.com, then launch it (`open -a Docker` on macOS) |
| Node.js 24     | runs the app (version pinned by `.nvmrc`)  | `node --version` → v24.x | `nvm install 24 && nvm use 24`                         |
| pnpm 11        | package manager (pinned in `package.json`) | `pnpm --version`         | `npm install -g pnpm` (with Node 24 active)            |

## 2. First-time setup

```bash
pnpm install                       # dependencies (network needed this once)
pnpm exec playwright install chromium   # browser for the e2e tests
pnpm exec supabase start           # local database stack (Docker must be running)
```

`supabase start` prints local URLs and keys. Create your `.env.local` from
the template, then copy the printed values into it:

```bash
cp .env.example .env.local
# Edit .env.local:
#  NEXT_PUBLIC_SUPABASE_URL          ← "API URL" printed by supabase start
#  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ← "publishable key" (sb_publishable_…)
#  SUPABASE_SECRET_KEY               ← "secret key" (sb_secret_…)
#  DEV_USER_PASSWORD                 ← invent one (8+ characters, never a real one)
```

Then create the local sign-in account (safe to re-run; it never duplicates):

```bash
pnpm exec tsx scripts/create-dev-user.ts
```

## 3. Start the application

Two terminals:

```bash
# Terminal A — the web app
pnpm dev                # → http://localhost:3000

# Terminal B — the workflow engine (needed for the "Run health check" button)
pnpm inngest:dev        # → inspector at http://localhost:8288
```

Sign in at http://localhost:3000/login with `dev@missionpilot.local` and the
`DEV_USER_PASSWORD` you chose. Useful local consoles: Supabase Studio
http://127.0.0.1:54323 · Inngest inspector http://localhost:8288.

## 4. Stop everything cleanly

```bash
# Ctrl+C in terminals A and B, then:
pnpm exec supabase stop        # keeps your local data
# or: pnpm exec supabase stop --no-backup   # wipes local data
```

## 5. Restart after an error

1. Docker running? `docker info` (if not: `open -a Docker`, wait, retry).
2. Stack healthy? `pnpm exec supabase status` — if broken:
   `pnpm exec supabase stop && pnpm exec supabase start`.
3. Database reset (rebuilds schema from migrations, wipes local data):
   `pnpm db:reset`, then re-create the user
   (`pnpm exec tsx scripts/create-dev-user.ts`) and regenerate types
   (`pnpm db:types`).
4. "Could not reach the workflow engine" in the UI → start Terminal B
   (`pnpm inngest:dev`).
5. Still stuck: run `pnpm verify` and read the first failing step's output.

## 6. Quality gates (same commands locally and in CI)

```bash
pnpm verify        # format check, lint, typecheck, unit tests, prod build
pnpm test:rls      # database security policies (pgTAP)
pnpm test:integration  # durable-workflow proofs (needs supabase start)
pnpm test:e2e      # browser journeys + accessibility scan (axe)
pnpm verify:full   # all of the above — the gate before any commit
```

CI (`.github/workflows/ci.yml`) runs exactly these scripts — no divergent
logic — against a disposable Supabase stack created and destroyed inside the
runner. It uses no secrets and read-only permissions.

## 7. Steps that always require human validation

Per `docs/loop-engineering/LOOP_CONTRACT.md`, an agent must stop and ask
before: creating any external service or account (GitHub, Vercel, Supabase
hosted, Inngest cloud) · deploying anything · spending money · sending any
application/message/email · destructive data changes · major architecture
changes · sensitive new dependencies · merging to main. Each phase milestone
also ends with an explicit human approval gate.

## 8. Accessibility

The e2e suite includes an automated axe scan (no serious/critical violations
allowed) and a scripted keyboard journey (skip link, tab order, visible
focus, keyboard-only login, navigation, health-check trigger, focus
restitution after an error). **Automated scans are a partial check, not
proof of WCAG conformance** — repeat the manual keyboard pass
(`tests/e2e/keyboard.spec.ts` mirrors its checklist) with a human, and add
screen-reader testing before any public release.

---

# Deployment

## Preparation (done in Phase 0)

The repository is deploy-ready: production build passes, `.env.example`
documents every variable, CI is committed, and production builds fail fast
if required configuration is missing (`src/lib/env-guards.ts` — Supabase
keys and Inngest keys are mandatory when `APP_ENV=production`, and
`INNGEST_DEV` is forbidden there).

## Actual deployment — OUT of Phase 0 scope

Creating hosted services requires the product owner and happens in a later,
explicitly approved step:

1. **GitHub**: create the repository, push, protect `main`; CI starts
   running on its own (no secrets to configure).
2. **Supabase hosted** (one project = production): disable sign-ups, enable
   asymmetric JWT signing keys. Migrations reach the hosted database through
   the **`Deploy migrations (hosted)`** workflow
   (`.github/workflows/deploy-migrations.yml`) — it runs `supabase db push`
   automatically when a migration lands on `main`, and can be run on demand
   from the Actions tab. Arm it once by adding two repository secrets
   (Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN`
   (Account → Access Tokens) and `SUPABASE_DB_PASSWORD` (the hosted project's
   database password); until both exist the job skips and stays green. After
   adding them, trigger the workflow once (Run workflow) to apply the current
   backlog. Confirm `SUPABASE_PROJECT_ID` in the workflow matches your project
   ref. Never edit the hosted schema via the dashboard. Local stays the dev
   environment; Vercel previews point at this single project (accepted risk
   for a single-user beta); no Supabase branching.
3. **Vercel**: import the repo (Git integration deploys; CI stays the
   quality gate), Node 24, set env vars per environment — production values
   from the hosted Supabase project; enable Vercel Authentication for
   previews. Env var changes only apply on the next deployment.
4. **Inngest**: install the Vercel Marketplace integration (sets
   `INNGEST_SIGNING_KEY`/`INNGEST_EVENT_KEY`, syncs on deploy). Note:
   Vercel Deployment Protection blocks Inngest sync on previews (Hobby:
   choose; Pro: use a protection bypass secret).
5. Before first production use: raise Supabase auth rate limits review,
   consider captcha on login, and re-run the full security gate
   (`SECURITY_AND_COMPLIANCE.md`).

## Non-negotiable engineering rule

No feature is complete until its acceptance criteria, automated checks,
failure handling, audit trail and user-visible explanation are implemented.
