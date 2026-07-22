-- pgTAP suite for the Phase 0 RLS policies and grants.
-- Runs via `pnpm test:rls` (supabase test db) against the LOCAL stack, inside
-- a rolled-back transaction. Fixtures are clearly synthetic (test.local,
-- fixed UUIDs) and are created as postgres — the admin/secret key is never
-- involved, so these tests exercise the anon/authenticated roles exactly as
-- the app would.
--
-- Grant model under test (migration init_phase0_schema):
--   anon            → no privileges at all (reads fail at the GRANT level);
--   authenticated   → SELECT everywhere + UPDATE on candidate_profiles only,
--                     rows scoped by RLS owner policies;
--   service_role    → full DML (bypasses RLS; used by confined server code).

begin;

select plan(28);

-- ---------------------------------------------------------------------------
-- Synthetic fixtures (rolled back at the end).
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.local', 'synthetic', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.local', 'synthetic', now(), now(), now());

-- 1. Trigger check: profiles were provisioned for both synthetic users.
select is(
  (select count(*) from public.candidate_profiles
   where user_id in ('11111111-1111-1111-1111-111111111111',
                     '22222222-2222-2222-2222-222222222222')),
  2::bigint,
  'on_auth_user_created provisions one profile per new user'
);

-- Operational fixtures: one run for A (with a step and a health result) and
-- one run for B, so cross-user isolation is proven in BOTH directions.
insert into public.agent_runs
  (id, user_id, workflow_name, workflow_version, correlation_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'system-health', '1.0', 'corr-a-1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', 'system-health', '1.0', 'corr-b-1');

insert into public.agent_steps (run_id, step_name, attempt, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'check-db', 1, 'completed');

insert into public.system_health_results
  (user_id, idempotency_key, db_ok, ai_mock_ok)
values
  ('11111111-1111-1111-1111-111111111111', 'health-a-1', true, true);

-- ---------------------------------------------------------------------------
-- 2-6. ANONYMOUS: no privileges at all — reads and writes fail at GRANT level.
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok($$select count(*) from public.candidate_profiles$$,
  '42501', null, 'anon cannot read profiles (permission denied)');
select throws_ok($$select count(*) from public.agent_runs$$,
  '42501', null, 'anon cannot read agent runs');
select throws_ok($$select count(*) from public.agent_steps$$,
  '42501', null, 'anon cannot read agent steps');
select throws_ok($$select count(*) from public.system_health_results$$,
  '42501', null, 'anon cannot read health results');
select throws_ok(
  $$insert into public.candidate_profiles (user_id)
    values ('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'anon cannot insert profiles');

reset role;

-- ---------------------------------------------------------------------------
-- 7-12. USER A: owner access works, scoped by RLS.
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111',
                    'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*) from public.candidate_profiles), 1::bigint,
  'A sees exactly one profile (their own)');
select is(
  (select user_id from public.candidate_profiles),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the visible profile belongs to A');
select is((select count(*) from public.agent_runs), 1::bigint,
  'A sees exactly one run although two exist');
select is(
  (select correlation_id from public.agent_runs),
  'corr-a-1',
  'the run visible to A is their own');
select is((select count(*) from public.agent_steps), 1::bigint,
  'A sees the steps of their own run');
select is((select count(*) from public.system_health_results), 1::bigint,
  'A sees their own health result');

update public.candidate_profiles
  set display_name = 'renamed-by-owner'
  where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select display_name from public.candidate_profiles
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'renamed-by-owner',
  'A can update their own profile');

-- 13. USER A cannot read B.
select is(
  (select count(*) from public.candidate_profiles
   where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint, 'A cannot read B''s profile');

-- Update attempt against B silently matches zero rows under RLS
-- (UPDATE grant exists on display_name; RLS hides B's row)…
update public.candidate_profiles
  set display_name = 'hacked-by-a'
  where user_id = '22222222-2222-2222-2222-222222222222';

-- Ownership transfer is impossible: user_id carries no UPDATE grant (column
-- scoping) and the policy's WITH CHECK pins it — either layer raises 42501.
select throws_ok(
  $$update public.candidate_profiles
    set user_id = '22222222-2222-2222-2222-222222222222'
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'A cannot transfer ownership of their profile');

-- Lifecycle is not client-writable: status has no UPDATE grant either.
select throws_ok(
  $$update public.candidate_profiles set status = 'published'
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'owner cannot flip their own status directly');

-- 14-18. USER A cannot write operational tables (no grants at all).
select throws_ok(
  $$insert into public.agent_runs
      (user_id, workflow_name, workflow_version, correlation_id)
    values ('11111111-1111-1111-1111-111111111111', 'x', '1.0', 'corr-x')$$,
  '42501', null, 'authenticated cannot insert agent_runs');
select throws_ok(
  $$insert into public.agent_steps (run_id, step_name, attempt, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rogue', 1, 'completed')$$,
  '42501', null, 'authenticated cannot insert agent_steps');
select throws_ok(
  $$insert into public.system_health_results
      (user_id, idempotency_key, db_ok, ai_mock_ok)
    values ('11111111-1111-1111-1111-111111111111', 'rogue-key', true, true)$$,
  '42501', null, 'authenticated cannot insert health results');
select throws_ok(
  $$insert into public.candidate_profiles (user_id)
    values ('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'authenticated cannot insert profiles directly');
select throws_ok(
  $$update public.agent_runs set status = 'completed'
    where correlation_id = 'corr-a-1'$$,
  '42501', null, 'authenticated cannot update agent_runs (even their own)');

reset role;

-- Verified as postgres: B's profile survived A's update attempt, and A's
-- profile still belongs to A after the transfer attempt.
select is(
  (select display_name from public.candidate_profiles
   where user_id = '22222222-2222-2222-2222-222222222222'),
  'user-b',
  'B''s profile is unchanged after A''s update attempt');
select is(
  (select count(*) from public.candidate_profiles
   where user_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'A''s profile still belongs to A after the transfer attempt');

-- ---------------------------------------------------------------------------
-- 20-22. USER B: symmetric isolation.
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222',
                    'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*) from public.agent_runs), 1::bigint,
  'B sees exactly one run although two exist');
select is(
  (select correlation_id from public.agent_runs),
  'corr-b-1',
  'the run visible to B is their own, not A''s');
select is((select count(*) from public.agent_steps), 0::bigint,
  'B sees no steps (their run has none; A''s steps are invisible)');
select is((select count(*) from public.system_health_results), 0::bigint,
  'B sees none of A''s health results');
select is(
  (select display_name from public.candidate_profiles),
  'user-b',
  'B sees exactly their own profile');

reset role;

select * from finish();

rollback;
