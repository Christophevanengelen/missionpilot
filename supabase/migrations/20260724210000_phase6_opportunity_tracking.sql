-- Phase 6 P8 — Application-tracking pipeline (CRM).
--
-- The mission-tracking layer a senior freelancer needs: an opt-in per-owner
-- row that moves an opportunity through a pipeline (saved → prepared → applied
-- → interview → offer → rejected), with a free note and an optional follow-up
-- date. Deterministic, no AI; built entirely on the user's own data under RLS.
-- One live tracking row per (profile, opportunity); untracking deletes it.

create table public.opportunity_tracking (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,
  stage text not null default 'saved'
    check (stage in ('saved', 'prepared', 'applied', 'interview', 'offer',
                     'rejected')),
  note text not null default '' check (char_length(note) <= 4000),
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, opportunity_id),
  foreign key (profile_id, opportunity_id)
    references public.opportunities (profile_id, id) on delete cascade
);

-- Keep updated_at honest on every change (used to order the pipeline).
create or replace function public.touch_opportunity_tracking()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- clock_timestamp() (real wall-clock), not now() (constant within a txn), so
  -- successive updates in one request/transaction still order correctly.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger opportunity_tracking_touch
  before update on public.opportunity_tracking
  for each row execute function public.touch_opportunity_tracking();

revoke all on function public.touch_opportunity_tracking() from public;

alter table public.opportunity_tracking enable row level security;

create policy "tracking owner select" on public.opportunity_tracking
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "tracking owner insert" on public.opportunity_tracking
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "tracking owner update" on public.opportunity_tracking
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "tracking owner delete" on public.opportunity_tracking
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.opportunity_tracking
  to authenticated;
