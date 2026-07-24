-- pgTAP suite for Phase 6 ai_application_drafts: owner-only RLS on every verb,
-- cross-profile writes blocked (RLS with-check + composite FK), jsonb bound.

begin;

select plan(11);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('aaaa1111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-s@test.local', 'synthetic', now(), now(), now()),
  ('bbbb6666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-t@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.ai_application_drafts', '42501',
  null, 'anon cannot read drafts');
reset role;

-- user S imports an opportunity, then stores a draft for it.
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaa1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.s_import',
  (select public.import_opportunity(
      '3333333333333333333333333333333333333333333333333333333333333333',
      '4444444444444444444444444444444444444444444444444444444444444444',
      'Data Engineer chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Data Engineer","organization":"Nova"}'::jsonb)::text),
  false);
select set_config('test.s_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, highlights, model,
   prompt_version, input_hash)
values
  (current_setting('test.s_profile')::uuid,
   (current_setting('test.s_import')::jsonb ->> 'opportunity_id')::uuid,
   'Madame, Monsieur, …', '["Pipelines Spark"]'::jsonb,
   'gpt-test', 'application-tailor-1', repeat('a', 64));

select is(
  (select count(*)::int from public.ai_application_drafts), 1,
  'S sees its own draft');

-- refresh: unique pair upserts, does not stack.
insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, highlights, model,
   prompt_version, input_hash)
values
  (current_setting('test.s_profile')::uuid,
   (current_setting('test.s_import')::jsonb ->> 'opportunity_id')::uuid,
   'Nouvelle version.', '[]'::jsonb,
   'gpt-test', 'application-tailor-1', repeat('b', 64))
on conflict (profile_id, opportunity_id) do update
  set cover_letter = excluded.cover_letter, input_hash = excluded.input_hash;

select is(
  (select count(*)::int from public.ai_application_drafts), 1,
  'refresh replaces the live draft instead of stacking');
select is(
  (select cover_letter from public.ai_application_drafts), 'Nouvelle version.',
  'the refreshed cover letter is stored');

-- jsonb array bound: > 12 highlights rejected.
select throws_ok(
  format(
    $$update public.ai_application_drafts set highlights = '%s'::jsonb$$,
    (select '[' || string_agg('"h"', ',') || ']'
       from generate_series(1, 13))),
  '23514', null, 'a highlights array over 12 entries is rejected');

reset role;

-- user T: sees none of S, cannot write into S.
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbb6666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.ai_application_drafts), 0,
  'T sees none of S''s drafts');

-- T claiming S's profile_id → RLS with-check blocks (42501).
select throws_ok(
  format(
    $$insert into public.ai_application_drafts
        (profile_id, opportunity_id, cover_letter, model, prompt_version,
         input_hash)
      values ('%s', '%s', 'intrusion', 'gpt-test', 'application-tailor-1',
              repeat('c', 64))$$,
    current_setting('test.s_profile'),
    (current_setting('test.s_import')::jsonb ->> 'opportunity_id')),
  '42501', null, 'T cannot insert a draft into S''s profile');

-- T with its OWN profile but S's opportunity → composite FK blocks (23503).
select throws_ok(
  format(
    $$insert into public.ai_application_drafts
        (profile_id, opportunity_id, cover_letter, model, prompt_version,
         input_hash)
      values ('%s', '%s', 'intrusion', 'gpt-test', 'application-tailor-1',
              repeat('d', 64))$$,
    (select id from public.candidate_profiles),
    (current_setting('test.s_import')::jsonb ->> 'opportunity_id')),
  '23503', null,
  'composite FK blocks T attaching a draft to S''s opportunity');

-- Cross-user update/delete: RLS filters S's rows out — no error, zero rows.
select lives_ok(
  $$update public.ai_application_drafts set cover_letter = 'tamper'$$,
  'T''s blanket update runs against zero visible rows');
select lives_ok(
  $$delete from public.ai_application_drafts$$,
  'T''s blanket delete runs against zero visible rows');

reset role;

-- back as S: the draft survived T's tampering intact.
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaa1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select cover_letter from public.ai_application_drafts), 'Nouvelle version.',
  'S''s draft untouched by T');
reset role;

select * from finish();

rollback;
