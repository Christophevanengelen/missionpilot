-- Apply Pack L3 — the tone contract: per-profile, versioned voice rules.
--
-- The manual campaign of 2026-08-17 drafted in the founder's own voice, in
-- whichever language the target listing used. Today the tailoring workflow
-- has neither: it writes in a fixed generic voice, always in French. This
-- migration stores the user's own tone rules as an APPEND-ONLY version
-- history — publishing version 2 never rewrites version 1, and a draft
-- generated under version 1 keeps citing version 1 forever.
--
-- Deliberate deviation from cv_variants' four-verb (select/insert/update/
-- delete) shape: immutability is enforced here as a DATABASE guarantee, not
-- an app-code promise. `authenticated` gets ONLY select and insert on this
-- table — no update, no delete grant — so "publishing a new version never
-- mutates a past version" cannot be violated by any future app code, however
-- it is written. FEATURE_APPLY_PACK.md's L3 text literally names cv_variants'
-- full four-verb pattern; this is a declared deviation, flagged in the loop
-- record for explicit reviewer/founder sign-off, not a silent one.
--
-- The seed content of a real tone contract (the founder's actual voice from
-- the 2026-08-17 campaign) is NOT in this repository and is not invented
-- here — this migration builds the mechanism only. A profile with no row in
-- this table drafts with a hardcoded generic default (see
-- src/lib/matching/tone-contract.ts), so nothing regresses.

create table public.tone_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  version integer not null check (version >= 1),
  -- The user's own words: formality, sentence length, what to avoid. This is
  -- the field the founder's real corpus will eventually populate.
  voice_rules text not null check (char_length(voice_rules) between 1 and 4000),
  signature_name text not null
    check (char_length(signature_name) between 1 and 200),
  salutation_fr text not null
    check (char_length(salutation_fr) between 1 and 200),
  salutation_en text not null
    check (char_length(salutation_en) between 1 and 200),
  closing_fr text not null check (char_length(closing_fr) between 1 and 200),
  closing_en text not null check (char_length(closing_en) between 1 and 200),
  -- User-specific additions to the built-in anti-cliché list, enforced by the
  -- style guardrail before a draft is ever stored (see style-guardrail.ts).
  banned_phrases jsonb not null default '[]'::jsonb
    check (jsonb_typeof(banned_phrases) = 'array'),
  -- Optional "what changed since the last version", in the user's own words.
  notes text check (notes is null or char_length(notes) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (profile_id, version),
  -- Lets the composite FK on ai_application_drafts prove a draft's tone
  -- contract stays inside the SAME profile (parity with cv_variants).
  unique (profile_id, id)
);

-- Element-level validation for banned_phrases, independent of any app code
-- (mirrors validate_opportunity_lists in
-- 20260724010000_phase2_opportunity_ingestion.sql): each entry a non-empty
-- trimmed string, at most 200 characters, at most 50 entries — enforced even
-- for a direct RPC caller, not only the UI that does not exist yet.
create function public.validate_tone_contract_banned_phrases()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if jsonb_array_length(new.banned_phrases) > 50 then
    raise exception 'banned_phrases exceeds 50 entries';
  end if;
  for v_item in select value from jsonb_array_elements(new.banned_phrases)
  loop
    if jsonb_typeof(v_item) <> 'string' then
      raise exception 'banned_phrases entries must be strings';
    end if;
    if char_length(btrim(v_item #>> '{}')) not between 1 and 200 then
      raise exception 'banned_phrases entries must be 1-200 characters';
    end if;
  end loop;
  return new;
end;
$$;

create trigger tone_contracts_validate_banned_phrases
  before insert or update on public.tone_contracts
  for each row execute function public.validate_tone_contract_banned_phrases();

revoke all on function public.validate_tone_contract_banned_phrases()
  from public, anon, authenticated;

alter table public.tone_contracts enable row level security;

create policy "tone contracts owner select" on public.tone_contracts
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "tone contracts owner insert" on public.tone_contracts
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- Deliberately no update/delete policy for authenticated: see the header.
-- `revoke all` FIRST (lesson replayed from cv_variants/offres_ecartees):
-- without it, anon and authenticated inherit TRUNCATE, which RLS never
-- filters. service_role keeps full DML for ops/admin correction — it has no
-- default rights on this stack.
revoke all on public.tone_contracts from anon, authenticated;
grant select, insert on public.tone_contracts to authenticated;
grant select, insert, update, delete on public.tone_contracts to service_role;

-- The live draft records the language it was written in (deterministically
-- detected from the OPPORTUNITY's own text at draft time — never the
-- profile's default, never hardcoded) and exactly which tone_contract
-- VERSION it was generated under, so a draft generated under version 1 keeps
-- citing version 1 forever, even after version 2 is published. Both columns
-- are nullable-safe / defaulted: existing rows and existing FR-only drafts
-- need no backfill and no forced regeneration.
alter table public.ai_application_drafts
  add column subject text
    check (subject is null or char_length(subject) between 1 and 200),
  add column language text not null default 'fr'
    check (language in ('fr', 'en')),
  add column tone_contract_id uuid,
  add constraint ai_application_drafts_tone_contract_same_profile
    foreign key (profile_id, tone_contract_id)
    references public.tone_contracts (profile_id, id)
    on delete set null (tone_contract_id);

-- Backs the referential action (parity with the cv_variant_id index).
create index ai_application_drafts_tone_contract_idx
  on public.ai_application_drafts (profile_id, tone_contract_id)
  where tone_contract_id is not null;

-- No rationale-clearing trigger is needed here (unlike cv_variant_id /
-- cv_variant_rationale): subject and language are populated independently of
-- whether a tone_contract exists, so there is no "why without which"
-- invariant to protect — an orphaned tone_contract_id simply means the draft
-- reverts to citing no version, while its subject/language stand on their
-- own.
