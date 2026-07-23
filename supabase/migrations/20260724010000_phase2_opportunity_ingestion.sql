-- Phase 2 / PR 1 — Opportunity ingestion: pasted-text import, immutable
-- source snapshots, and normalized extraction. Mirrors DOMAIN_MODEL.md
-- (Opportunity + OpportunitySnapshot) with the same house posture as Phase 1:
-- owner-scoped RLS, immutable snapshots (no UPDATE grant), structural bounds
-- in the DB, and extraction facts that are UNVERIFIED until the user confirms
-- (SECURITY_AND_COMPLIANCE.md key rule).

-- ---------------------------------------------------------------------------
-- opportunities — the canonical, user-owned representation of a role/mission.
-- Deduplicated per owner by canonical_fingerprint (Phase 2 later PRs use it;
-- here it is captured and uniquely constrained per profile).

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  canonical_fingerprint text not null
    check (canonical_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'imported'
    check (status in ('imported', 'archived')),
  title text check (char_length(title) between 1 and 500),
  organization text check (char_length(organization) between 1 and 300),
  engagement_type text
    check (engagement_type in ('freelance', 'part_time', 'interim', 'permanent')),
  seniority text check (char_length(seniority) between 1 and 120),
  description text check (char_length(description) <= 20000),
  requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requirements) = 'array'),
  responsibilities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(responsibilities) = 'array'),
  skills jsonb not null default '[]'::jsonb
    check (jsonb_typeof(skills) = 'array'),
  location_text text check (char_length(location_text) between 1 and 300),
  remote_type text
    check (remote_type in ('remote_only', 'hybrid', 'onsite', 'unspecified')),
  compensation_min integer check (compensation_min between 0 and 100000000),
  compensation_max integer check (compensation_max between 0 and 100000000),
  compensation_currency text
    check (compensation_currency in ('EUR', 'USD', 'GBP', 'CHF')),
  compensation_period text
    check (compensation_period in ('day', 'hour', 'month', 'year')),
  source_name text check (char_length(source_name) between 1 and 300),
  source_url text check (char_length(source_url) between 1 and 2000),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, canonical_fingerprint),
  -- Composite key so a snapshot can be constrained to the SAME profile.
  unique (profile_id, id),
  constraint opportunities_comp_coherent
    check (
      compensation_min is null
      or compensation_max is null
      or compensation_min <= compensation_max
    )
);

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

create policy "owner reads own opportunities"
  on public.opportunities for select
  using (
    profile_id in (
      select id from public.candidate_profiles
      where user_id = (select auth.uid())
    )
  );

-- Writes go through a SECURITY DEFINER import function (below): no direct
-- insert/update grant for authenticated (the canonical row is only ever
-- created atomically with its snapshot).
revoke all on public.opportunities from anon, authenticated;
grant select on public.opportunities to authenticated;
grant select, insert, update, delete on public.opportunities to service_role;

-- Element-level validation for the normalized jsonb string lists — the DB
-- stays an INDEPENDENT enforcement point (mirrors the Zod caps, same posture
-- as the profile-preferences trigger): every entry is a non-empty string of
-- bounded length AFTER trimming, at most 50 entries per list. So even a
-- direct RPC caller (bypassing the app's Zod layer) cannot store oversized
-- content in its own rows.
create or replace function public.validate_opportunity_lists()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_col text;
  v_max int;
  v_val jsonb;
  v_item jsonb;
begin
  foreach v_col in array
    array['requirements', 'responsibilities', 'skills']
  loop
    v_max := case when v_col = 'skills' then 120 else 500 end;
    v_val := to_jsonb(new) -> v_col;
    if jsonb_array_length(v_val) > 50 then
      raise exception '% exceeds 50 entries', v_col;
    end if;
    for v_item in select value from jsonb_array_elements(v_val)
    loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception '% entries must be strings', v_col;
      end if;
      if char_length(btrim(v_item #>> '{}')) not between 1 and v_max then
        raise exception '% entries must be 1-% characters', v_col, v_max;
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

create trigger opportunities_validate_lists
  before insert or update on public.opportunities
  for each row execute function public.validate_opportunity_lists();

revoke all on function public.validate_opportunity_lists()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- opportunity_snapshots — immutable source capture (provenance/reprocessing).

create table public.opportunity_snapshots (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  profile_id uuid not null,
  retrieval_method text not null
    check (retrieval_method in ('paste', 'url', 'import')),
  retrieved_at timestamptz not null default now(),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  raw_text text not null check (char_length(raw_text) between 1 and 100000),
  parser_version text not null
    check (char_length(parser_version) between 1 and 40),
  -- The source-policy gate (Phase 2 URL PR) records its decision here; paste
  -- is always allowed.
  source_policy_decision text not null default 'allowed'
    check (source_policy_decision in ('allowed', 'blocked', 'manual_only')),
  created_at timestamptz not null default now(),
  -- Composite FK: a snapshot belongs to an opportunity OF THE SAME profile.
  foreign key (profile_id, opportunity_id)
    references public.opportunities (profile_id, id) on delete cascade
);

alter table public.opportunity_snapshots enable row level security;

create policy "owner reads own snapshots"
  on public.opportunity_snapshots for select
  using (
    profile_id in (
      select id from public.candidate_profiles
      where user_id = (select auth.uid())
    )
  );

-- Immutable: NO update grant for ANY role; service_role may insert/delete
-- (erasure workflow) but never UPDATE — snapshots never change after capture.
revoke all on public.opportunity_snapshots from anon, authenticated;
grant select on public.opportunity_snapshots to authenticated;
grant select, insert, delete on public.opportunity_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- Atomic import: create-or-touch the canonical opportunity from the caller's
-- OWN profile, insert an immutable snapshot, and return both ids. The DB is
-- the sole author of the canonical row (same posture as publish_profile_
-- version). Extraction fields are supplied by the caller (mock/AI) and are
-- UNVERIFIED assertions — the app layer treats them as such.

create or replace function public.import_opportunity(
  p_canonical_fingerprint text,
  p_content_hash text,
  p_raw_text text,
  p_retrieval_method text,
  p_parser_version text,
  p_source_policy_decision text,
  p_normalized jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_profile_id uuid;
  v_opp_id uuid;
  v_snapshot_id uuid;
  v_created boolean := false;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select id into v_profile_id from public.candidate_profiles
    where user_id = v_uid
    for update;
  if not found then
    raise exception 'profile not found' using errcode = '42501';
  end if;

  -- Dedup per owner: reuse an existing canonical row, else create one.
  select id into v_opp_id from public.opportunities
    where profile_id = v_profile_id
      and canonical_fingerprint = p_canonical_fingerprint;

  if v_opp_id is null then
    insert into public.opportunities (
      profile_id, canonical_fingerprint, title, organization,
      engagement_type, seniority, description, requirements,
      responsibilities, skills, location_text, remote_type,
      compensation_min, compensation_max, compensation_currency,
      compensation_period, source_name, source_url
    ) values (
      v_profile_id, p_canonical_fingerprint,
      nullif(p_normalized->>'title', ''),
      nullif(p_normalized->>'organization', ''),
      nullif(p_normalized->>'engagement_type', ''),
      nullif(p_normalized->>'seniority', ''),
      nullif(p_normalized->>'description', ''),
      coalesce(p_normalized->'requirements', '[]'::jsonb),
      coalesce(p_normalized->'responsibilities', '[]'::jsonb),
      coalesce(p_normalized->'skills', '[]'::jsonb),
      nullif(p_normalized->>'location_text', ''),
      nullif(p_normalized->>'remote_type', ''),
      (p_normalized->>'compensation_min')::integer,
      (p_normalized->>'compensation_max')::integer,
      nullif(p_normalized->>'compensation_currency', ''),
      nullif(p_normalized->>'compensation_period', ''),
      nullif(p_normalized->>'source_name', ''),
      nullif(p_normalized->>'source_url', '')
    )
    returning id into v_opp_id;
    v_created := true;
  else
    update public.opportunities set last_seen_at = now()
      where id = v_opp_id;
  end if;

  insert into public.opportunity_snapshots (
    opportunity_id, profile_id, retrieval_method, content_hash,
    raw_text, parser_version, source_policy_decision
  ) values (
    v_opp_id, v_profile_id, p_retrieval_method, p_content_hash,
    p_raw_text, p_parser_version, p_source_policy_decision
  )
  returning id into v_snapshot_id;

  return jsonb_build_object(
    'opportunity_id', v_opp_id,
    'snapshot_id', v_snapshot_id,
    'created', v_created
  );
end;
$$;

revoke all on function public.import_opportunity(
  text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_opportunity(
  text, text, text, text, text, text, jsonb) to authenticated;
