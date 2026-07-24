-- Phase 6 P1 — Transparent per-requirement match + gap analysis.
--
-- A deeper, on-demand companion to ai_match_insights (the card-level "why this
-- match"): for ONE opportunity the LLM extracts each stated requirement,
-- classifies it must-have vs nice-to-have, marks it Covered / Partial /
-- Missing against the user's VALIDATED profile, links the evidence, and — for
-- gaps — proposes an HONEST upgrade suggestion (upskill or truthful reframe,
-- never fabricate). It is a PROPOSAL layered on the deterministic gate + score,
-- never a substitute.
--
-- Freshness by input_hash (profile dossier + ad text); one LIVE breakdown per
-- (profile, opportunity) via upsert. Same RLS + composite-FK pattern as
-- ai_match_insights.

create table public.ai_match_breakdowns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,
  -- [{ text, importance: must|nice, status: covered|partial|missing,
  --    evidence, suggestion }] — inner shape enforced by the app's Zod gate
  --  (the app is the only writer, RLS-scoped); the DB bounds the array.
  requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requirements) = 'array'
           and jsonb_array_length(requirements) <= 40),
  summary text not null check (char_length(summary) between 1 and 2000),
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

alter table public.ai_match_breakdowns enable row level security;

create policy "breakdowns owner select" on public.ai_match_breakdowns
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "breakdowns owner insert" on public.ai_match_breakdowns
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "breakdowns owner update" on public.ai_match_breakdowns
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "breakdowns owner delete" on public.ai_match_breakdowns
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.ai_match_breakdowns
  to authenticated;
