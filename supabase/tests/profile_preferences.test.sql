-- pgTAP suite for Phase 1 / PR E — target preferences & hard constraints on
-- candidate_profiles. Same conventions as profile_rls.test.sql: synthetic
-- fixtures, rolled-back transaction, roles exercised exactly as the app does.
-- Proves: owner writes own preferences under the column-scoped grant, the
-- validation trigger and CHECK constraints reject bad values, cross-user
-- writes touch nothing, and non-granted columns stay unwritable.

begin;

select plan(15);

-- Fixtures: users E and F (the signup trigger creates their profiles).
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-5555-5555-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-e@test.local', 'synthetic', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-f@test.local', 'synthetic', now(), now(), now());

select set_config('test.e_profile_id',
  (select id::text from public.candidate_profiles
    where user_id = '55555555-5555-5555-5555-555555555555'), false);
select set_config('test.f_profile_id',
  (select id::text from public.candidate_profiles
    where user_id = '66666666-6666-6666-6666-666666666666'), false);

-- ---------------------------------------------------------------------------
-- 1) anon: no write to preferences.

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$update public.candidate_profiles set remote_policy = 'hybrid'$$,
  '42501', null, 'anon cannot update preferences');
reset role;

-- ---------------------------------------------------------------------------
-- 2) user E: writes own preferences under the column grant.

select set_config('request.jwt.claims',
  json_build_object(
    'sub', '55555555-5555-5555-5555-555555555555',
    'role', 'authenticated')::text,
  true);
set local role authenticated;

select lives_ok(
  $$update public.candidate_profiles set
      target_role_families = '["Design produit","Design systems"]'::jsonb,
      preferred_engagement_types = '["freelance","interim"]'::jsonb,
      languages = '["Français","Anglais"]'::jsonb,
      allowed_work_regions = '["UE","Suisse"]'::jsonb,
      hard_exclusions = '["Défense","Jeux d''argent"]'::jsonb,
      target_day_rate = 800,
      minimum_day_rate = 650,
      base_currency = 'EUR',
      remote_policy = 'remote_first',
      timezone_overlap = 'CET ±3 h',
      travel_tolerance = 'occasional'
    where id = current_setting('test.e_profile_id')::uuid$$,
  'E writes a full, valid preference set on its own profile');

select is(
  (select target_day_rate from public.candidate_profiles
    where id = current_setting('test.e_profile_id')::uuid),
  800, 'E reads back its own target day rate');
select is(
  (select jsonb_array_length(preferred_engagement_types)
    from public.candidate_profiles
    where id = current_setting('test.e_profile_id')::uuid),
  2, 'E reads back its own engagement types');

-- 3) CHECK constraints (23514) — enums and ranges.
select throws_ok(
  $$update public.candidate_profiles set minimum_day_rate = 900
    where id = current_setting('test.e_profile_id')::uuid$$,
  '23514', null, 'a minimum above the target is refused');
select throws_ok(
  $$update public.candidate_profiles set target_day_rate = 50000
    where id = current_setting('test.e_profile_id')::uuid$$,
  '23514', null, 'a day rate above the cap is refused');
select throws_ok(
  $$update public.candidate_profiles set base_currency = 'BTC'
    where id = current_setting('test.e_profile_id')::uuid$$,
  '23514', null, 'an unknown currency is refused');
select throws_ok(
  $$update public.candidate_profiles set remote_policy = 'telepathy'
    where id = current_setting('test.e_profile_id')::uuid$$,
  '23514', null, 'an unknown remote policy is refused');

-- 4) Validation trigger (P0001) — list bounds and element checks.
select throws_ok(
  $$update public.candidate_profiles
      set preferred_engagement_types = '["freelance","astronaut"]'::jsonb
    where id = current_setting('test.e_profile_id')::uuid$$,
  'P0001', null, 'an unknown engagement type is refused by the trigger');
select throws_ok(
  $$update public.candidate_profiles set languages = '[42]'::jsonb
    where id = current_setting('test.e_profile_id')::uuid$$,
  'P0001', null, 'a non-string list element is refused by the trigger');
select throws_ok(
  $$update public.candidate_profiles set languages = '["   "]'::jsonb
    where id = current_setting('test.e_profile_id')::uuid$$,
  'P0001', null,
  'a whitespace-only element is refused (length measured after trim)');
select throws_ok(
  $$update public.candidate_profiles set languages =
      (select jsonb_agg(g::text) from generate_series(1, 21) g)
    where id = current_setting('test.e_profile_id')::uuid$$,
  'P0001', null, 'more than 20 list entries is refused by the trigger');

-- 5) Column-scoped grant: a non-granted column stays unwritable.
select throws_ok(
  $$update public.candidate_profiles set status = 'published'
    where id = current_setting('test.e_profile_id')::uuid$$,
  '42501', null, 'E cannot write a non-granted column (status)');

reset role;

-- ---------------------------------------------------------------------------
-- 6) user F: cannot see or write E's preferences.

select set_config('request.jwt.claims',
  json_build_object(
    'sub', '66666666-6666-6666-6666-666666666666',
    'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*)::int from public.candidate_profiles
    where id = current_setting('test.e_profile_id')::uuid),
  0, 'F cannot read E''s profile row (RLS)');

-- A blind write of E's row runs without error but touches zero rows (the
-- RLS USING filter hides it); the service_role check below proves nothing
-- changed. Plain top-level statement — no data-modifying CTE in a subquery.
update public.candidate_profiles set remote_policy = 'onsite_ok'
  where id = current_setting('test.e_profile_id')::uuid;

reset role;

set local role service_role;
select is(
  (select remote_policy from public.candidate_profiles
    where id = current_setting('test.e_profile_id')::uuid),
  'remote_first', 'E''s remote policy is unchanged after F''s attempt');
reset role;

select * from finish();

rollback;
