-- pgTAP suite for Phase 5 AI match insights: owner-only RLS on every verb,
-- cross-profile writes blocked, list hygiene trigger, one-live-insight upsert.

begin;

select plan(15);

-- Fixtures: users M and N (signup trigger creates their profiles).
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('99999999-9999-9999-9999-999999999999',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-m@test.local', 'synthetic', now(), now(), now()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-n@test.local', 'synthetic', now(), now(), now());

-- ---------------------------------------------------------------------------
-- 1) anon: zero access.

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.ai_match_insights', '42501',
  null, 'anon cannot read insights');
reset role;

-- ---------------------------------------------------------------------------
-- 2) user M: imports an opportunity, then stores an insight for it.

select set_config('request.jwt.claims',
  json_build_object('sub', '99999999-9999-9999-9999-999999999999',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.m_import',
  (select public.import_opportunity(
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'Data Engineer chez Nova', 'paste', 'paste-extract-1', 'allowed',
      '{"title":"Data Engineer","organization":"Nova"}'::jsonb)::text),
  false);

-- Captured HERE (as M, RLS lets M see it) for the cross-profile attack below.
select set_config('test.m_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.ai_match_insights
  (profile_id, opportunity_id, fit, rationale, strengths, gaps,
   model, prompt_version, input_hash)
values
  ((select id from public.candidate_profiles),
   (current_setting('test.m_import')::jsonb ->> 'opportunity_id')::uuid,
   'strong', 'Profil data senior aligné sur le poste.',
   '["Spark"]'::jsonb, '["Anglais C1 non prouvé"]'::jsonb,
   'gpt-test', 'match-insight-1', repeat('a', 64));

select is(
  (select count(*)::int from public.ai_match_insights), 1,
  'M sees its own insight');

-- 3) One LIVE insight per opportunity: the unique pair upserts, not stacks.
insert into public.ai_match_insights
  (profile_id, opportunity_id, fit, rationale, model, prompt_version,
   input_hash)
values
  ((select id from public.candidate_profiles),
   (current_setting('test.m_import')::jsonb ->> 'opportunity_id')::uuid,
   'good', 'Analyse rafraîchie après mise à jour du profil.',
   'gpt-test', 'match-insight-1', repeat('b', 64))
on conflict (profile_id, opportunity_id) do update
  set fit = excluded.fit, rationale = excluded.rationale,
      input_hash = excluded.input_hash;

select is(
  (select count(*)::int from public.ai_match_insights), 1,
  'refresh replaces the live insight instead of stacking');
select is(
  (select fit from public.ai_match_insights), 'good',
  'the refreshed fit is stored');

-- 4) List hygiene: non-string / oversized entries are rejected.
select throws_like(
  $$update public.ai_match_insights set strengths = '[42]'::jsonb$$,
  '%insight list entries must be strings%',
  'non-string list entries are rejected');
select throws_like(
  format(
    $$update public.ai_match_insights set gaps = '["%s"]'::jsonb$$,
    repeat('x', 201)),
  '%insight list entries must be strings%',
  'oversized list entries are rejected');

-- 5) Fit values outside the contract are rejected.
select throws_ok(
  $$update public.ai_match_insights set fit = 'perfect'$$,
  '23514', null, 'fit outside strong/good/weak is rejected');

reset role;

-- ---------------------------------------------------------------------------
-- 6) user N: sees nothing of M, cannot write into M's profile.

select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.ai_match_insights), 0,
  'N sees none of M''s insights');

select throws_ok(
  format(
    $$insert into public.ai_match_insights
        (profile_id, opportunity_id, fit, rationale, model,
         prompt_version, input_hash)
      values ('%s', '%s', 'weak', 'intrusion', 'gpt-test',
              'match-insight-1', repeat('c', 64))$$,
    current_setting('test.m_profile'),
    (current_setting('test.m_import')::jsonb ->> 'opportunity_id')),
  '42501', null, 'N cannot insert an insight into M''s profile');

-- The OTHER leg of the invariant: N claiming its OWN profile but pointing at
-- M's opportunity — the RLS with-check passes, ONLY the composite FK blocks
-- attaching an insight to another profile's opportunity.
select throws_ok(
  format(
    $$insert into public.ai_match_insights
        (profile_id, opportunity_id, fit, rationale, model,
         prompt_version, input_hash)
      values ('%s', '%s', 'weak', 'intrusion', 'gpt-test',
              'match-insight-1', repeat('d', 64))$$,
    (select id from public.candidate_profiles),
    (current_setting('test.m_import')::jsonb ->> 'opportunity_id')),
  '23503', null,
  'composite FK blocks N attaching an insight to M''s opportunity');

-- Cross-user UPDATE/DELETE: RLS filters M's rows out of N's statements — no
-- error, zero rows affected (data integrity re-asserted as M just below).
select lives_ok(
  $$update public.ai_match_insights set rationale = 'tamper'$$,
  'N''s blanket update runs against zero visible rows');
select lives_ok(
  $$delete from public.ai_match_insights$$,
  'N''s blanket delete runs against zero visible rows');

reset role;

-- ---------------------------------------------------------------------------
-- 7) back as M: the insight survived N's tampering attempts intact.

select set_config('request.jwt.claims',
  json_build_object('sub', '99999999-9999-9999-9999-999999999999',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.ai_match_insights), 1,
  'M''s insight survived N''s delete');
select is(
  (select rationale from public.ai_match_insights),
  'Analyse rafraîchie après mise à jour du profil.',
  'M''s insight rationale untouched by N''s update');

reset role;

-- Guard: the attack above really targeted M's captured profile id.
select isnt(
  current_setting('test.m_profile'), '',
  'fixture: M''s profile id was captured');

select * from finish();

rollback;
