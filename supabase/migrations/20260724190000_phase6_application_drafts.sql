-- Phase 6 P6 — Grounded per-opportunity application tailoring.
--
-- For ONE opportunity, the LLM drafts a tailored French cover letter and the
-- ranked matching highlights, GROUNDED in the user's validated profile. It is
-- a DRAFT the human reviews, edits and sends themselves ("prepare, don't
-- send" — never an autonomous submission): the honesty + anti-hallucination
-- rules forbid inventing experience or figures; where a metric would help, the
-- draft carries an explicit placeholder for the user to fill.
--
-- One LIVE draft per (profile, opportunity) via upsert; freshness by
-- input_hash. Same RLS + composite-FK pattern as ai_match_insights/breakdowns.

create table public.ai_application_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,
  cover_letter text not null
    check (char_length(cover_letter) between 1 and 6000),
  -- Ranked matching highlights (short strings); inner shape enforced by the
  -- app's Zod gate (the app is the only writer, RLS-scoped).
  highlights jsonb not null default '[]'::jsonb
    check (jsonb_typeof(highlights) = 'array'
           and jsonb_array_length(highlights) <= 12),
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

alter table public.ai_application_drafts enable row level security;

create policy "drafts owner select" on public.ai_application_drafts
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "drafts owner insert" on public.ai_application_drafts
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "drafts owner update" on public.ai_application_drafts
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "drafts owner delete" on public.ai_application_drafts
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.ai_application_drafts
  to authenticated;
