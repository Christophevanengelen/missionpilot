-- Apply Pack L1 — CV variants as first-class, owner-scoped data.
--
-- The manual executive-search campaign of 2026-08-17 validated that a small
-- set of named CV variants (e.g. "Design Lead", "Product Lead") with explicit
-- "use when" rules is enough to route any application. This migration stores
-- those variants per profile, and lets the live application draft say WHICH
-- variant it was written to accompany, and WHY. The product prepares, the
-- human sends: nothing here submits anything.
--
-- Same RLS + grant pattern as ai_application_drafts. Real variants are user
-- data entered through the app; dev seeds stay clearly synthetic.

create table public.cv_variants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  headline text not null check (char_length(headline) between 1 and 200),
  -- When to pick this variant, in the user's own words; the tailoring
  -- workflow quotes these rules to justify its choice.
  use_when text not null check (char_length(use_when) between 1 and 2000),
  -- Exact attachment file name the user sends; the app never renames the
  -- user's files silently.
  file_name text not null check (char_length(file_name) between 1 and 255),
  language text not null default 'en' check (language in ('en', 'fr')),
  created_at timestamptz not null default now(),
  unique (profile_id, name),
  -- Lets referencing rows prove they stay inside the same profile.
  unique (profile_id, id)
);

alter table public.cv_variants enable row level security;

create policy "cv variants owner select" on public.cv_variants
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "cv variants owner insert" on public.cv_variants
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "cv variants owner update" on public.cv_variants
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "cv variants owner delete" on public.cv_variants
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- LE `revoke all` D'ABORD (leçon d'effacement_prerequis, rejouée par
-- offres_ecartees) : sans lui, anon et authenticated héritent notamment de
-- TRUNCATE, que la RLS ne filtre pas — et account_deletion.test.sql le
-- détecte. service_role reçoit son DML explicitement : il n'a aucun droit
-- par défaut sur ce stack.
revoke all on public.cv_variants from anon, authenticated;
grant select, insert, update, delete on public.cv_variants to authenticated;
grant select, insert, update, delete on public.cv_variants to service_role;

-- The live draft records which variant it accompanies and why. The composite
-- FK forbids attaching another profile's variant; deleting a variant clears
-- only the reference (column-scoped set null), never the draft.
alter table public.ai_application_drafts
  add column cv_variant_id uuid,
  add column cv_variant_rationale text
    check (cv_variant_rationale is null
           or char_length(cv_variant_rationale) between 1 and 1000),
  add constraint ai_application_drafts_variant_same_profile
    foreign key (profile_id, cv_variant_id)
    references public.cv_variants (profile_id, id)
    on delete set null (cv_variant_id);

-- Backs the referential action (parity with the drafts→opportunities FK).
create index ai_application_drafts_cv_variant_idx
  on public.ai_application_drafts (profile_id, cv_variant_id)
  where cv_variant_id is not null;

-- The "why" must never outlive the "which": whenever a draft is written
-- without a variant reference (including the FK's set-null action, which
-- fires this trigger), the rationale is cleared with it.
create function public.clear_cv_variant_rationale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cv_variant_id is null then
    new.cv_variant_rationale := null;
  end if;
  return new;
end;
$$;

-- Not callable outside its trigger context, but revoked per house hygiene.
revoke all on function public.clear_cv_variant_rationale()
  from public, anon, authenticated;

create trigger ai_application_drafts_variant_rationale
  before insert or update on public.ai_application_drafts
  for each row execute function public.clear_cv_variant_rationale();
