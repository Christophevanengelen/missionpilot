-- Phase 1 / PR E — Target preferences and hard constraints.
--
-- DOMAIN_MODEL.md places these directly on candidate_profiles: they are the
-- user's CURRENT positioning (not versioned claims — the Phase 3 hard
-- constraint engine reads them live). All columns are nullable/empty by
-- default: stating preferences is optional and never blocks the interview.
--
-- Bounds strategy (house style, PR A): structural and enum bounds enforced
-- in the DATABASE (types, counts, element caps, allowed values); the app
-- boundary re-validates with Zod for honest messages. String lists are
-- jsonb arrays of short strings — the trigger below validates every
-- element, so a privileged writer cannot smuggle malformed content either.

alter table public.candidate_profiles
  add column target_role_families jsonb not null default '[]'::jsonb
    check (jsonb_typeof(target_role_families) = 'array'),
  add column preferred_engagement_types jsonb not null default '[]'::jsonb
    check (jsonb_typeof(preferred_engagement_types) = 'array'),
  add column languages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(languages) = 'array'),
  add column allowed_work_regions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allowed_work_regions) = 'array'),
  add column hard_exclusions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hard_exclusions) = 'array'),
  add column target_day_rate integer
    check (target_day_rate between 0 and 20000),
  add column minimum_day_rate integer
    check (minimum_day_rate between 0 and 20000),
  add column base_currency text
    check (base_currency in ('EUR', 'USD', 'GBP', 'CHF')),
  add column remote_policy text
    check (
      remote_policy in ('remote_only', 'remote_first', 'hybrid', 'onsite_ok')
    ),
  add column timezone_overlap text
    check (timezone_overlap is null
           or char_length(timezone_overlap) between 1 and 120),
  add column travel_tolerance text
    check (travel_tolerance in ('none', 'occasional', 'frequent')),
  add constraint candidate_profiles_rate_floor_coherent
    check (
      minimum_day_rate is null
      or target_day_rate is null
      or minimum_day_rate <= target_day_rate
    );

-- Element-level validation for the jsonb string lists: every entry is a
-- non-empty string of at most 120 characters AFTER trimming, at most 20
-- entries per list; engagement types are restricted to the documented set.
-- Lengths are measured on the TRIMMED value so the DB enforces exactly the
-- same semantics as the app's Zod `trimmed()` — a privileged/direct writer
-- cannot smuggle an all-whitespace or over-long-after-trim element either.
-- `timezone_overlap` is likewise trim-normalised (empty ⇒ NULL).
create or replace function public.validate_profile_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_col text;
  v_val jsonb;
  v_item jsonb;
begin
  new.timezone_overlap := nullif(btrim(new.timezone_overlap), '');

  foreach v_col in array array[
    'target_role_families',
    'preferred_engagement_types',
    'languages',
    'allowed_work_regions',
    'hard_exclusions'
  ]
  loop
    v_val := to_jsonb(new) -> v_col;
    if jsonb_array_length(v_val) > 20 then
      raise exception '% exceeds 20 entries', v_col;
    end if;
    for v_item in select value from jsonb_array_elements(v_val)
    loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception '% entries must be strings', v_col;
      end if;
      if char_length(btrim(v_item #>> '{}')) not between 1 and 120 then
        raise exception '% entries must be 1-120 characters', v_col;
      end if;
    end loop;
  end loop;

  if exists (
    select 1 from jsonb_array_elements_text(new.preferred_engagement_types) e
    where e not in ('freelance', 'part_time', 'interim', 'permanent')
  ) then
    raise exception 'unknown engagement type';
  end if;

  return new;
end;
$$;

create trigger candidate_profiles_validate_preferences
  before insert or update on public.candidate_profiles
  for each row execute function public.validate_profile_preferences();

-- Column-scoped write access for the owner (RLS owner-row policies from
-- Phase 0 stay the row filter; the grant list is the column filter).
grant update (
  target_role_families,
  preferred_engagement_types,
  languages,
  allowed_work_regions,
  hard_exclusions,
  target_day_rate,
  minimum_day_rate,
  base_currency,
  remote_policy,
  timezone_overlap,
  travel_tolerance
) on public.candidate_profiles to authenticated;

revoke all on function public.validate_profile_preferences()
  from public, anon, authenticated;
