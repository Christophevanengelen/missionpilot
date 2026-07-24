-- pgTAP suite for Phase 6 ai_interview_briefs (P13): owner-only RLS on every verb,
-- cross-profile writes blocked (RLS with-check + composite FK), jsonb bound.

begin;

select plan(11);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('eeee1111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-w@test.local', 'synthetic', now(), now(), now()),
  ('ffff6666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-x@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.ai_interview_briefs', '42501',
  null, 'anon cannot read drafts');
reset role;

-- user S imports an opportunity, then stores a draft for it.
select set_config('request.jwt.claims',
  json_build_object('sub', 'eeee1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.w_import',
  (select public.import_opportunity(
      '7777777777777777777777777777777777777777777777777777777777777777',
      '8888888888888888888888888888888888888888888888888888888888888888',
      'Data Engineer chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Data Engineer","organization":"Nova"}'::jsonb)::text),
  false);
select set_config('test.w_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.ai_interview_briefs
  (profile_id, opportunity_id, questions, talking_points, model,
   prompt_version, input_hash)
values
  (current_setting('test.w_profile')::uuid,
   (current_setting('test.w_import')::jsonb ->> 'opportunity_id')::uuid,
   '[{"question":"Parlez-moi de Spark","angle":"Citer Nova"}]'::jsonb, '["Pipelines Spark"]'::jsonb,
   'gpt-test', 'interview-brief-1', repeat('a', 64));

select is(
  (select count(*)::int from public.ai_interview_briefs), 1,
  'W sees its own brief');

-- refresh: unique pair upserts, does not stack.
insert into public.ai_interview_briefs
  (profile_id, opportunity_id, questions, talking_points, model,
   prompt_version, input_hash)
values
  (current_setting('test.w_profile')::uuid,
   (current_setting('test.w_import')::jsonb ->> 'opportunity_id')::uuid,
   '[]'::jsonb, '[]'::jsonb,
   'gpt-test', 'interview-brief-1', repeat('b', 64))
on conflict (profile_id, opportunity_id) do update
  set questions = excluded.questions, input_hash = excluded.input_hash;

select is(
  (select count(*)::int from public.ai_interview_briefs), 1,
  'refresh replaces the live brief instead of stacking');
select is(
  (select jsonb_array_length(questions)::int from public.ai_interview_briefs), 0,
  'the refreshed questions array is stored');

-- jsonb array bound: > 12 highlights rejected.
select throws_ok(
  format(
    $$update public.ai_interview_briefs set talking_points = '%s'::jsonb$$,
    (select '[' || string_agg('"h"', ',') || ']'
       from generate_series(1, 9))),
  '23514', null, 'a talking_points array over 8 entries is rejected');

reset role;

-- user T: sees none of S, cannot write into S.
select set_config('request.jwt.claims',
  json_build_object('sub', 'ffff6666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.ai_interview_briefs), 0,
  'X sees none of W''s briefs');

-- T claiming S's profile_id → RLS with-check blocks (42501).
select throws_ok(
  format(
    $$insert into public.ai_interview_briefs
        (profile_id, opportunity_id, model, prompt_version,
         input_hash)
      values ('%s', '%s', 'gpt-test', 'interview-brief-1',
              repeat('c', 64))$$,
    current_setting('test.w_profile'),
    (current_setting('test.w_import')::jsonb ->> 'opportunity_id')),
  '42501', null, 'X cannot insert a brief into W''s profile');

-- T with its OWN profile but S's opportunity → composite FK blocks (23503).
select throws_ok(
  format(
    $$insert into public.ai_interview_briefs
        (profile_id, opportunity_id, model, prompt_version,
         input_hash)
      values ('%s', '%s', 'gpt-test', 'interview-brief-1',
              repeat('d', 64))$$,
    (select id from public.candidate_profiles),
    (current_setting('test.w_import')::jsonb ->> 'opportunity_id')),
  '23503', null,
  'composite FK blocks X attaching a brief to W''s opportunity');

-- Cross-user update/delete: RLS filters S's rows out — no error, zero rows.
select lives_ok(
  $$update public.ai_interview_briefs set model = 'tamper'$$,
  'X''s blanket update runs against zero visible rows');
select lives_ok(
  $$delete from public.ai_interview_briefs$$,
  'X''s blanket delete runs against zero visible rows');

reset role;

-- back as S: the draft survived T's tampering intact.
select set_config('request.jwt.claims',
  json_build_object('sub', 'eeee1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select model from public.ai_interview_briefs), 'gpt-test',
  'W''s brief untouched by X');
reset role;

select * from finish();

rollback;
