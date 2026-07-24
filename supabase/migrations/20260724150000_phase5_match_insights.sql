-- Phase 5 PR C — AI match insights ("pourquoi ce match").
--
-- One LIVE insight per (profile, opportunity): the LLM's honest judgement of
-- the match — fit level, a short French rationale, strengths present in the
-- ad and gaps the profile does not cover. The insight is a PROPOSAL layered
-- on top of the deterministic gate + score, never a substitute for them.
--
-- Freshness: input_hash fingerprints the exact (profile dossier, ad text)
-- pair that produced the insight; when either changes the stored row is
-- stale and the next analysis run replaces it (upsert on the unique pair).
-- Honesty: needs_review carries the model's own uncertainty signal to the UI.

create table public.ai_match_insights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,
  fit text not null check (fit in ('strong', 'good', 'weak')),
  rationale text not null
    check (char_length(rationale) between 1 and 2000),
  strengths jsonb not null default '[]'::jsonb
    check (jsonb_typeof(strengths) = 'array'
           and jsonb_array_length(strengths) <= 5),
  gaps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gaps) = 'array'
           and jsonb_array_length(gaps) <= 5),
  needs_review boolean not null default false,
  model text not null check (char_length(model) between 1 and 200),
  prompt_version text not null
    check (char_length(prompt_version) between 1 and 100),
  input_hash text not null check (char_length(input_hash) = 64),
  created_at timestamptz not null default now(),
  -- One live insight per opportunity, and the opportunity must belong to the
  -- SAME profile (composite FK, same pattern as opportunity_snapshots).
  unique (profile_id, opportunity_id),
  foreign key (profile_id, opportunity_id)
    references public.opportunities (profile_id, id) on delete cascade
);

-- Entries of strengths/gaps must be non-empty bounded strings (same list
-- hygiene as validate_opportunity_lists, applied to jsonb arrays).
create or replace function public.validate_insight_lists()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
begin
  for entry in select jsonb_array_elements(new.strengths || new.gaps) loop
    if jsonb_typeof(entry) <> 'string'
       or char_length(entry #>> '{}') < 1
       or char_length(entry #>> '{}') > 200 then
      raise exception 'insight list entries must be strings of 1-200 chars';
    end if;
  end loop;
  return new;
end;
$$;

create trigger validate_ai_match_insight_lists
  before insert or update on public.ai_match_insights
  for each row execute function public.validate_insight_lists();

revoke all on function public.validate_insight_lists() from public;

alter table public.ai_match_insights enable row level security;

-- Owner-only, every verb (the app reads and upserts through the session).
create policy "insights owner select" on public.ai_match_insights
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "insights owner insert" on public.ai_match_insights
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "insights owner update" on public.ai_match_insights
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "insights owner delete" on public.ai_match_insights
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.ai_match_insights
  to authenticated;
