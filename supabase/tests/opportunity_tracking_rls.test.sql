-- pgTAP suite for Phase 6 opportunity_tracking: owner-only RLS on every verb,
-- cross-profile writes blocked (RLS with-check + composite FK), stage CHECK,
-- and the updated_at touch trigger.

begin;

select plan(11);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('cccc1111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-u@test.local', 'synthetic', now(), now(), now()),
  ('dddd6666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-v@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.opportunity_tracking', '42501',
  null, 'anon cannot read tracking');
reset role;

-- user U imports an opportunity, then tracks it.
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccc1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.u_import',
  (select public.import_opportunity(
      '5555555555555555555555555555555555555555555555555555555555555555',
      '6666666666666666666666666666666666666666666666666666666666666666',
      'Data Engineer chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Data Engineer","organization":"Nova"}'::jsonb)::text),
  false);
select set_config('test.u_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.opportunity_tracking (profile_id, opportunity_id, stage, note)
values
  (current_setting('test.u_profile')::uuid,
   (current_setting('test.u_import')::jsonb ->> 'opportunity_id')::uuid,
   'saved', 'repérée');

select is(
  (select count(*)::int from public.opportunity_tracking), 1,
  'U sees its own tracking row');
select is(
  (select stage from public.opportunity_tracking), 'saved',
  'the stage is stored');

-- stage CHECK rejects an unknown stage.
select throws_ok(
  $$update public.opportunity_tracking set stage = 'archived'$$,
  '23514', null, 'an unknown stage is rejected');

-- updated_at touch trigger bumps on update.
select set_config('test.u_before',
  (select updated_at from public.opportunity_tracking)::text, false);
select pg_sleep(0.01);
update public.opportunity_tracking set stage = 'applied';
select ok(
  (select updated_at from public.opportunity_tracking)
    > current_setting('test.u_before')::timestamptz,
  'updated_at is touched on update');

reset role;

-- user V: sees none of U, cannot write into U.
select set_config('request.jwt.claims',
  json_build_object('sub', 'dddd6666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.opportunity_tracking), 0,
  'V sees none of U''s tracking');

-- V claiming U's profile_id → RLS with-check blocks (42501).
select throws_ok(
  format(
    $$insert into public.opportunity_tracking (profile_id, opportunity_id, stage)
      values ('%s', '%s', 'saved')$$,
    current_setting('test.u_profile'),
    (current_setting('test.u_import')::jsonb ->> 'opportunity_id')),
  '42501', null, 'V cannot insert tracking into U''s profile');

-- V with its OWN profile but U's opportunity → composite FK blocks (23503).
select throws_ok(
  format(
    $$insert into public.opportunity_tracking (profile_id, opportunity_id, stage)
      values ('%s', '%s', 'saved')$$,
    (select id from public.candidate_profiles),
    (current_setting('test.u_import')::jsonb ->> 'opportunity_id')),
  '23503', null,
  'composite FK blocks V tracking U''s opportunity');

-- Cross-user update/delete: RLS filters U's rows out — no error, zero rows.
select lives_ok(
  $$update public.opportunity_tracking set note = 'tamper'$$,
  'V''s blanket update runs against zero visible rows');
select lives_ok(
  $$delete from public.opportunity_tracking$$,
  'V''s blanket delete runs against zero visible rows');

reset role;

-- back as U: the tracking row survived V's tampering intact.
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccc1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select note from public.opportunity_tracking), 'repérée',
  'U''s tracking note untouched by V');
reset role;

select * from finish();

rollback;
