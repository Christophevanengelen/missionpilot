-- pgTAP suite for Apply Pack L1 cv_variants: owner-only RLS on every verb
-- (select, insert, update, delete), cross-profile attachment blocked by the
-- composite FK, and variant deletion clearing the draft's reference AND its
-- rationale without touching the draft.

begin;

select plan(15);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('abab1111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-y@test.local', 'synthetic', now(), now(), now()),
  ('cdcd6666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-z@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.cv_variants', '42501',
  null, 'anon cannot read cv variants');
reset role;

-- user U creates a variant, an opportunity, and a draft that references it.
select set_config('request.jwt.claims',
  json_build_object('sub', 'abab1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.u_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.cv_variants
  (profile_id, name, headline, use_when, file_name, language)
values
  (current_setting('test.u_profile')::uuid, 'Design Lead',
   'Design Lead / Lead Product Designer',
   'Design leadership searches: Head of UX, Director Product Design.',
   'CV_Design_Lead.pdf', 'en');

select is(
  (select count(*)::int from public.cv_variants), 1,
  'U sees its own variant');

update public.cv_variants set headline = 'Design Lead / Head of Design';

select is(
  (select headline from public.cv_variants),
  'Design Lead / Head of Design',
  'U can update its own variant');

select set_config('test.u_variant',
  (select id from public.cv_variants)::text, false);

-- variant names are unique per profile.
select throws_ok(
  format(
    $$insert into public.cv_variants
        (profile_id, name, headline, use_when, file_name)
      values ('%s', 'Design Lead', 'Twice', 'duplicate', 'x.pdf')$$,
    current_setting('test.u_profile')),
  '23505', null, 'variant names are unique per profile');

select set_config('test.u_import',
  (select public.import_opportunity(
      repeat('3', 64), repeat('4', 64),
      'Head of Design chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Head of Design","organization":"Nova"}'::jsonb)::text),
  false);

insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, highlights, model,
   prompt_version, input_hash)
values
  (current_setting('test.u_profile')::uuid,
   (current_setting('test.u_import')::jsonb ->> 'opportunity_id')::uuid,
   'Madame, Monsieur, …', '[]'::jsonb,
   'gpt-test', 'application-tailor-1', repeat('a', 64));

update public.ai_application_drafts
   set cv_variant_id = current_setting('test.u_variant')::uuid,
       cv_variant_rationale = 'Design leadership search.';

select is(
  (select cv_variant_id::text from public.ai_application_drafts),
  current_setting('test.u_variant'),
  'the draft records which variant it accompanies');
reset role;

-- user V: sees none of U, cannot write into U, cannot borrow U''s variant.
select set_config('request.jwt.claims',
  json_build_object('sub', 'cdcd6666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.cv_variants), 0,
  'V sees none of U''s variants');

select throws_ok(
  format(
    $$insert into public.cv_variants
        (profile_id, name, headline, use_when, file_name)
      values ('%s', 'Injected', 'x', 'x', 'x.pdf')$$,
    current_setting('test.u_profile')),
  '42501', null, 'V cannot create a variant inside U''s profile');

select lives_ok(
  $$update public.cv_variants set name = 'Hijack'$$,
  'V''s blanket update runs against zero visible rows');

select lives_ok(
  $$delete from public.cv_variants$$,
  'V''s blanket delete removes zero visible rows');

select set_config('test.v_profile',
  (select id from public.candidate_profiles)::text, false);

select set_config('test.v_import',
  (select public.import_opportunity(
      repeat('5', 64), repeat('6', 64),
      'CPO chez Vega', 'paste', 'paste-extract-2', 'allowed',
      '{"title":"CPO","organization":"Vega"}'::jsonb)::text),
  false);

insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, highlights, model,
   prompt_version, input_hash)
values
  (current_setting('test.v_profile')::uuid,
   (current_setting('test.v_import')::jsonb ->> 'opportunity_id')::uuid,
   'Bonjour, …', '[]'::jsonb,
   'gpt-test', 'application-tailor-1', repeat('c', 64));

select throws_ok(
  format(
    $$update public.ai_application_drafts set cv_variant_id = '%s'$$,
    current_setting('test.u_variant')),
  '23503', null, 'V cannot attach U''s variant to its own draft');
reset role;

-- back as U: nothing was hijacked; deletion clears reference AND rationale.
select set_config('request.jwt.claims',
  json_build_object('sub', 'abab1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select name from public.cv_variants), 'Design Lead',
  'U''s variant is untouched by V''s blanket update');

delete from public.cv_variants
 where id = current_setting('test.u_variant')::uuid;

select is(
  (select count(*)::int from public.cv_variants), 0,
  'U can delete its own variant');

select is(
  (select count(*)::int from public.ai_application_drafts), 1,
  'the draft survives the variant deletion');

select is(
  (select cv_variant_id from public.ai_application_drafts), null::uuid,
  'the draft reference is cleared, not the draft');

select is(
  (select cv_variant_rationale from public.ai_application_drafts), null::text,
  'the rationale never outlives the variant it explains');
reset role;

select * from finish();

rollback;
