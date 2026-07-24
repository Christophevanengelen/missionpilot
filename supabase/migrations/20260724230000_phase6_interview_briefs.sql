-- Phase 6 P13 — Per-opportunity interview preparation brief.
--
-- The last link of the premium cycle (discover → match → prepare → apply →
-- track → INTERVIEW → offer): for ONE opportunity, the LLM drafts likely
-- interview questions mapped to the candidate's REAL evidence, plus talking
-- points grounded in the validated profile. It is preparation material the
-- human reviews — never a script of fabricated claims, and never a promise
-- about the outcome.
--
-- One LIVE brief per (profile, opportunity) via upsert; freshness by
-- input_hash. Same RLS + composite-FK pattern as the other AI artefacts.

create table public.ai_interview_briefs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,
  -- [{ question, angle }] — inner shape enforced by the app's Zod gate.
  questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array'
           and jsonb_array_length(questions) <= 12),
  talking_points jsonb not null default '[]'::jsonb
    check (jsonb_typeof(talking_points) = 'array'
           and jsonb_array_length(talking_points) <= 8),
  needs_review boolean not null default false,
  model text not null check (char_length(model) between 1 and 200),
  prompt_version text not null
    check (char_length(prompt_version) between 1 and 100),
  input_hash text not null check (char_length(input_hash) = 64),
  created_at timestamptz not null default now(),
  unique (profile_id, opportunity_id),
  foreign key (profile_id, opportunity_id)
    references public.opportunities (profile_id, id) on delete cascade
);

alter table public.ai_interview_briefs enable row level security;

create policy "briefs owner select" on public.ai_interview_briefs
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "briefs owner insert" on public.ai_interview_briefs
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "briefs owner update" on public.ai_interview_briefs
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "briefs owner delete" on public.ai_interview_briefs
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.ai_interview_briefs
  to authenticated;
