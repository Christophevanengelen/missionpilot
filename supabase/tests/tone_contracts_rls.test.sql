-- pgTAP suite for Apply Pack L3 tone_contracts: anon fully blocked; owner can
-- select/insert; owner CANNOT update or delete (42501, proving the
-- append-only grant is a database guarantee, not app discipline); cross-user
-- cannot read, insert into, or attach another profile's tone_contract to
-- their own draft (composite FK 23503); two versions for the same profile
-- coexist and both remain individually citable by drafts (an old draft never
-- silently repoints to the newest version).

begin;

select plan(18);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('efef1111-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-tone-u@test.local', 'synthetic', now(), now(), now()),
  ('a1a16666-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-tone-v@test.local', 'synthetic', now(), now(), now());

-- anon: no read, no write.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.tone_contracts', '42501',
  null, 'anon cannot read tone contracts');
select throws_ok(
  $$insert into public.tone_contracts
      (profile_id, version, voice_rules, signature_name,
       salutation_fr, salutation_en, closing_fr, closing_en)
    values (gen_random_uuid(), 1, 'x', 'x', 'x', 'x', 'x', 'x')$$,
  '42501', null, 'anon cannot insert a tone contract');
reset role;

-- user U publishes version 1, then version 2 (append-only: both coexist).
select set_config('request.jwt.claims',
  json_build_object('sub', 'efef1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.u_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.tone_contracts
  (profile_id, version, voice_rules, signature_name,
   salutation_fr, salutation_en, closing_fr, closing_en, banned_phrases)
values
  (current_setting('test.u_profile')::uuid, 1,
   'Ton direct, phrases courtes, aucun superlatif.', 'A. Dupont',
   'Madame, Monsieur,', 'Dear Hiring Manager,', 'Cordialement,',
   'Best regards,', '["passionné de longue date"]'::jsonb);

select is(
  (select count(*)::int from public.tone_contracts), 1,
  'U sees its own tone contract');

select set_config('test.u_v1',
  (select id from public.tone_contracts where version = 1)::text, false);

insert into public.tone_contracts
  (profile_id, version, voice_rules, signature_name,
   salutation_fr, salutation_en, closing_fr, closing_en)
values
  (current_setting('test.u_profile')::uuid, 2,
   'Ton direct, plus court encore.', 'A. Dupont',
   'Bonjour,', 'Hello,', 'Bien à vous,', 'Regards,');

select is(
  (select count(*)::int from public.tone_contracts), 2,
  'both versions coexist — publishing v2 did not remove v1');

select set_config('test.u_v2',
  (select id from public.tone_contracts where version = 2)::text, false);

-- append-only at the DB layer: no update, no delete grant for authenticated.
select throws_ok(
  $$update public.tone_contracts set voice_rules = 'hijacked'$$,
  '42501', null, 'U cannot update a tone contract — no UPDATE grant');

select throws_ok(
  'delete from public.tone_contracts',
  '42501', null, 'U cannot delete a tone contract — no DELETE grant');

-- versions are unique per profile.
select throws_ok(
  format(
    $$insert into public.tone_contracts
        (profile_id, version, voice_rules, signature_name,
         salutation_fr, salutation_en, closing_fr, closing_en)
      values ('%s', 1, 'dup', 'x', 'x', 'x', 'x', 'x')$$,
    current_setting('test.u_profile')),
  '23505', null, 'version is unique per profile');

-- banned_phrases element validation runs even for a direct insert.
select throws_ok(
  format(
    $$insert into public.tone_contracts
        (profile_id, version, voice_rules, signature_name,
         salutation_fr, salutation_en, closing_fr, closing_en, banned_phrases)
      values ('%s', 3, 'x', 'x', 'x', 'x', 'x', 'x', '["", "ok"]'::jsonb)$$,
    current_setting('test.u_profile')),
  'P0001', null, 'an empty banned_phrases entry is rejected');

-- a draft cites tone_contract v1; publishing v2 never repoints it.
select set_config('test.u_import',
  (select public.import_opportunity(
      repeat('7', 64), repeat('8', 64),
      'Head of Design chez Lyra', 'paste', 'paste-extract-3', 'allowed',
      '{"title":"Head of Design","organization":"Lyra"}'::jsonb)::text),
  false);

insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, subject, language, highlights,
   model, prompt_version, input_hash, tone_contract_id)
values
  (current_setting('test.u_profile')::uuid,
   (current_setting('test.u_import')::jsonb ->> 'opportunity_id')::uuid,
   'Madame, Monsieur, …', 'Candidature — Head of Design', 'fr', '[]'::jsonb,
   'gpt-test', 'application-tailor-3', repeat('d', 64),
   current_setting('test.u_v1')::uuid);

select is(
  (select tone_contract_id::text from public.ai_application_drafts),
  current_setting('test.u_v1'),
  'the draft cites tone contract v1');

-- publishing v2 (already done above) leaves the draft pointing at v1 still.
select is(
  (select tone_contract_id::text from public.ai_application_drafts),
  current_setting('test.u_v1'),
  'v1 stays cited after v2 is published — never silently repointed');

select is(
  (select count(*)::int from public.tone_contracts
    where id = current_setting('test.u_v2')::uuid),
  1,
  'v2 remains individually citable even though no draft cites it yet');
reset role;

-- user V: sees none of U's tone contracts, cannot write into U's profile,
-- cannot attach U's tone contract to V's own draft.
select set_config('request.jwt.claims',
  json_build_object('sub', 'a1a16666-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.tone_contracts), 0,
  'V sees none of U''s tone contracts');

select throws_ok(
  format(
    $$insert into public.tone_contracts
        (profile_id, version, voice_rules, signature_name,
         salutation_fr, salutation_en, closing_fr, closing_en)
      values ('%s', 1, 'x', 'x', 'x', 'x', 'x', 'x')$$,
    current_setting('test.u_profile')),
  '42501', null, 'V cannot insert a tone contract into U''s profile');

select set_config('test.v_profile',
  (select id from public.candidate_profiles)::text, false);

select set_config('test.v_import',
  (select public.import_opportunity(
      repeat('9', 64), repeat('1', 64),
      'CPO chez Rigel', 'paste', 'paste-extract-4', 'allowed',
      '{"title":"CPO","organization":"Rigel"}'::jsonb)::text),
  false);

insert into public.ai_application_drafts
  (profile_id, opportunity_id, cover_letter, subject, language, highlights,
   model, prompt_version, input_hash)
values
  (current_setting('test.v_profile')::uuid,
   (current_setting('test.v_import')::jsonb ->> 'opportunity_id')::uuid,
   'Bonjour, …', 'Candidature — CPO', 'fr', '[]'::jsonb,
   'gpt-test', 'application-tailor-3', repeat('e', 64));

select throws_ok(
  format(
    $$update public.ai_application_drafts set tone_contract_id = '%s'$$,
    current_setting('test.u_v1')),
  '23503', null, 'V cannot attach U''s tone contract to its own draft');

select throws_ok(
  $$update public.tone_contracts set voice_rules = 'hijack attempt'$$,
  '42501', null, 'V cannot update a tone contract — no UPDATE grant');

select throws_ok(
  'delete from public.tone_contracts',
  '42501', null, 'V cannot delete a tone contract — no DELETE grant');
reset role;

-- back as U: nothing was hijacked or lost.
select set_config('request.jwt.claims',
  json_build_object('sub', 'efef1111-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.tone_contracts), 2,
  'U still has both versions — V''s attempts changed nothing');

select is(
  (select voice_rules from public.tone_contracts where version = 1),
  'Ton direct, phrases courtes, aucun superlatif.',
  'v1''s content is untouched');
reset role;

select * from finish();

rollback;
