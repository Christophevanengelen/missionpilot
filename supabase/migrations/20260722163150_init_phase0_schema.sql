-- Phase 0 schema: user profile ownership stub + operational run records.
-- Field names follow docs/DOMAIN_MODEL.md. The full 22-table model arrives in
-- Phases 1-3. RLS is enabled in this same migration for every table (deny by
-- default: no write policies for `authenticated` on operational tables —
-- writes go through the confined server secret-key client, which performs its
-- own explicit ownership checks; see src/lib/db/admin.ts).

-- ---------------------------------------------------------------------------
-- Helper: updated_at maintenance (fixed search_path per security policy).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- candidate_profiles — ownership anchor (Phase 0 stub; versioning in Phase 1).
create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_profiles enable row level security;

create trigger candidate_profiles_set_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

create policy "owner can read own profile"
  on public.candidate_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can update own profile"
  on public.candidate_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No insert/delete policies: rows are created by the auth trigger below and
-- removed only via the documented privacy workflow (DOMAIN_MODEL.md).

-- Explicit least-privilege grants (the CLI's default ACLs grant almost
-- nothing useful — and leave TRUNCATE to anon, which we revoke).
-- UPDATE is column-scoped: the owner may edit display_name only; id,
-- created_at, user_id and the status lifecycle are not client-writable
-- (status transitions arrive with the Phase 1 publish workflow).
revoke all on public.candidate_profiles from anon, authenticated;
grant select on public.candidate_profiles to authenticated;
grant update (display_name) on public.candidate_profiles to authenticated;
-- service_role keeps delete for the documented privacy-deletion workflow.
grant select, insert, update, delete on public.candidate_profiles to service_role;

-- ---------------------------------------------------------------------------
-- Trigger on auth.users: provision the profile stub at account creation.
-- SECURITY DEFINER with an explicitly fixed search_path (project requirement):
-- runs with the function owner's rights, referencing only fully-qualified
-- names, so a compromised search_path cannot hijack resolution.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.candidate_profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- agent_runs — top-level execution traces (DOMAIN_MODEL.md AgentRun).
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow_name text not null,
  workflow_version text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  correlation_id text not null unique,
  entity_type text,
  entity_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  estimated_cost numeric(12, 6) not null default 0,
  error_code text,
  error_summary text
);

alter table public.agent_runs enable row level security;

create index agent_runs_user_id_idx on public.agent_runs (user_id);

create policy "owner can read own runs"
  on public.agent_runs for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No write policies: operational writes are server-side only.
-- Trace tables are append-only by design: no DELETE even for service_role
-- (deletion goes through the documented privacy workflow, added when built).
revoke all on public.agent_runs from anon, authenticated;
grant select on public.agent_runs to authenticated;
grant select, insert, update on public.agent_runs to service_role;

-- ---------------------------------------------------------------------------
-- agent_steps — per-step traces (DOMAIN_MODEL.md AgentStep).
create table public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  step_name text not null,
  attempt integer not null default 1 check (attempt >= 1),
  provider text,
  model text,
  prompt_version text,
  input_hash text,
  output_hash text,
  schema_valid boolean,
  token_usage jsonb,
  latency_ms integer,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  unique (run_id, step_name, attempt)
);

alter table public.agent_steps enable row level security;

create index agent_steps_run_id_idx on public.agent_steps (run_id);

create policy "owner can read steps of own runs"
  on public.agent_steps for select
  to authenticated
  using (
    exists (
      select 1
      from public.agent_runs r
      where r.id = agent_steps.run_id
        and r.user_id = (select auth.uid())
    )
  );

-- No write policies: operational writes are server-side only.
revoke all on public.agent_steps from anon, authenticated;
grant select on public.agent_steps to authenticated;
grant select, insert, update on public.agent_steps to service_role;

-- ---------------------------------------------------------------------------
-- system_health_results — durable-workflow idempotency proof (Phase 0).
create table public.system_health_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  idempotency_key text not null unique,
  db_ok boolean not null,
  ai_mock_ok boolean not null,
  details jsonb,
  checked_at timestamptz not null default now()
);

alter table public.system_health_results enable row level security;

create index system_health_results_user_id_idx
  on public.system_health_results (user_id);

create policy "owner can read own health results"
  on public.system_health_results for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No write policies: operational writes are server-side only.
revoke all on public.system_health_results from anon, authenticated;
grant select on public.system_health_results to authenticated;
grant select, insert, update on public.system_health_results to service_role;

-- ---------------------------------------------------------------------------
-- Function hygiene: CREATE FUNCTION grants EXECUTE to PUBLIC by default.
-- Neither function is callable outside its trigger context, but revoke for
-- defense-in-depth consistency with the table-level posture.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
