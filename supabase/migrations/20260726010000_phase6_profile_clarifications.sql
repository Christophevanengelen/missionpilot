-- Phase 6 — Clarifications: the answers to the questions the product asks.
--
-- THE HOLE THIS CLOSES. The career reading already returns `questions` when a
-- dossier lists titles but never scope, and the interface already displays
-- them. There was no field to answer in, no action to receive an answer, and
-- no place to put one. The product asked and looked away — which is worse than
-- not asking, because it teaches that answering is pointless.
--
-- One row per question ASKED, keyed by a folded form of the question so the
-- same thing is never asked twice. A row carries exactly one of three
-- outcomes, and the distinction is load-bearing:
--
--   answered  — `answer` is set. It becomes a DECLARED fact in the dossier.
--   skipped   — the person chose "I don't know". Recorded so we stop asking.
--   pending   — neither. Still owed an answer.
--
-- "I don't know" is a first-class outcome, not an absence. Forcing an answer
-- with no escape hatch does not produce knowledge, it produces invention — and
-- on a product whose only stored asset is the profile, an invented answer
-- corrupts the one thing we keep.

create table public.profile_clarifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  -- The stable identity of the question: a folded form (accent- and
  -- punctuation-free, lowercased) computed by the application. Two phrasings
  -- of the same question collapse onto one row, which is what makes "never ask
  -- the same thing twice" enforceable in the database rather than hoped for.
  question_key text not null
    check (char_length(question_key) between 1 and 200),
  -- The question as it was actually put to the person, kept verbatim so the
  -- answer can always be read back in its original context.
  question text not null check (char_length(question) between 1 and 300),
  -- Where the question came from. 'gap' questions are derived deterministically
  -- from what the profile is missing; 'career' questions come from the AI
  -- trajectory reading. Never merged: one is explainable, the other is not.
  origin text not null check (origin in ('gap', 'career')),
  answer text check (char_length(answer) between 1 and 2000),
  skipped boolean not null default false,
  asked_at timestamptz not null default now(),
  settled_at timestamptz,
  -- A row is answered or skipped, never both, and either state must be dated.
  constraint clarification_settled_consistently check (
    (answer is null and skipped = false and settled_at is null)
    or (answer is not null and skipped = false and settled_at is not null)
    or (answer is null and skipped = true and settled_at is not null)
  ),
  unique (profile_id, question_key)
);

-- The read path is always "what is still owed for this profile".
create index profile_clarifications_pending
  on public.profile_clarifications (profile_id, asked_at)
  where settled_at is null;

alter table public.profile_clarifications enable row level security;

create policy "clarifications owner select" on public.profile_clarifications
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "clarifications owner insert" on public.profile_clarifications
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "clarifications owner update" on public.profile_clarifications
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "clarifications owner delete" on public.profile_clarifications
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.profile_clarifications
  to authenticated;

-- Stamping note (2026-07-26). This migration was briefly renamed to
-- 20260725234500 on the theory that its timestamp — taken from local time,
-- and so twelve minutes ahead of the deploy job's clock — had made
-- `supabase db push` skip it. That diagnosis was WRONG: the migration had
-- already been applied, and "Remote database is up to date" meant exactly
-- what it said. The rename then broke the migration history, because the
-- remote had recorded the original version. Name restored.
--
-- What the incident actually taught, and why the deploy workflow now prints
-- `supabase migration list --linked`: the failure was not the timestamp, it
-- was that the deploy log could not distinguish "already applied" from
-- "nothing found to apply". Ambiguity in a deploy log gets paid for later, by
-- someone reasoning confidently from too little.
