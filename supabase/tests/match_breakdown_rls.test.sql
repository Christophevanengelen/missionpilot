-- pgTAP suite for Phase 6 ai_match_breakdowns: owner-only RLS on every verb,
-- cross-profile writes blocked (RLS with-check + composite FK), and the jsonb
-- array bound. Synthetic fixtures, rolled-back transaction.

begin;

select plan(11);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('11111111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-p@test.local', 'synthetic', now(), now(), now()),
  ('66666666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-q@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.ai_match_breakdowns', '42501',
  null, 'anon cannot read breakdowns');
reset role;

-- user P imports an opportunity, then stores a breakdown for it.
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.p_import',
  (select public.import_opportunity(
      '1111111111111111111111111111111111111111111111111111111111111111',
      '2222222222222222222222222222222222222222222222222222222222222222',
      'Data Engineer chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Data Engineer","organization":"Nova"}'::jsonb)::text),
  false);
select set_config('test.p_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.ai_match_breakdowns
  (profile_id, opportunity_id, summary, requirements, model, prompt_version,
   input_hash)
values
  (current_setting('test.p_profile')::uuid,
   (current_setting('test.p_import')::jsonb ->> 'opportunity_id')::uuid,
   'Bonne adéquation.',
   '[{"text":"Spark","importance":"must","status":"covered","evidence":"x","suggestion":""}]'::jsonb,
   'gpt-test', 'match-breakdown-1', repeat('a', 64));

select is(
  (select count(*)::int from public.ai_match_breakdowns), 1,
  'P sees its own breakdown');

-- refresh: unique pair upserts, does not stack.
insert into public.ai_match_breakdowns
  (profile_id, opportunity_id, summary, requirements, model, prompt_version,
   input_hash)
values
  (current_setting('test.p_profile')::uuid,
   (current_setting('test.p_import')::jsonb ->> 'opportunity_id')::uuid,
   'Analyse rafraîchie.', '[]'::jsonb,
   'gpt-test', 'match-breakdown-1', repeat('b', 64))
on conflict (profile_id, opportunity_id) do update
  set summary = excluded.summary, requirements = excluded.requirements,
      input_hash = excluded.input_hash;

select is(
  (select count(*)::int from public.ai_match_breakdowns), 1,
  'refresh replaces the live breakdown instead of stacking');
select is(
  (select summary from public.ai_match_breakdowns), 'Analyse rafraîchie.',
  'the refreshed summary is stored');

-- jsonb array bound: > 40 entries rejected.
select throws_ok(
  format(
    $$update public.ai_match_breakdowns set requirements = '%s'::jsonb$$,
    (select '[' || string_agg('{"text":"r","importance":"nice","status":"missing","evidence":"e","suggestion":""}', ',') || ']'
       from generate_series(1, 41))),
  '23514', null, 'a requirements array over 40 entries is rejected');

reset role;

-- user Q: sees none of P, cannot write into P.
select set_config('request.jwt.claims',
  json_build_object('sub', '66666666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.ai_match_breakdowns), 0,
  'Q sees none of P''s breakdowns');

-- Q claiming P's profile_id → RLS with-check blocks (42501).
select throws_ok(
  format(
    $$insert into public.ai_match_breakdowns
        (profile_id, opportunity_id, summary, model, prompt_version, input_hash)
      values ('%s', '%s', 'intrusion', 'gpt-test', 'match-breakdown-1',
              repeat('c', 64))$$,
    current_setting('test.p_profile'),
    (current_setting('test.p_import')::jsonb ->> 'opportunity_id')),
  '42501', null, 'Q cannot insert a breakdown into P''s profile');

-- Q with its OWN profile but P's opportunity → composite FK blocks (23503).
select throws_ok(
  format(
    $$insert into public.ai_match_breakdowns
        (profile_id, opportunity_id, summary, model, prompt_version, input_hash)
      values ('%s', '%s', 'intrusion', 'gpt-test', 'match-breakdown-1',
              repeat('d', 64))$$,
    (select id from public.candidate_profiles),
    (current_setting('test.p_import')::jsonb ->> 'opportunity_id')),
  '23503', null,
  'composite FK blocks Q attaching a breakdown to P''s opportunity');

-- Cross-user update/delete: RLS filters P's rows out — zero rows affected.
select lives_ok(
  $$update public.ai_match_breakdowns set summary = 'tamper'$$,
  'Q''s blanket update runs against zero visible rows');
select lives_ok(
  $$delete from public.ai_match_breakdowns$$,
  'Q''s blanket delete runs against zero visible rows');

reset role;

-- back as P: the breakdown survived Q's tampering intact.
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select summary from public.ai_match_breakdowns), 'Analyse rafraîchie.',
  'P''s breakdown untouched by Q');
reset role;

select * from finish();

rollback;
