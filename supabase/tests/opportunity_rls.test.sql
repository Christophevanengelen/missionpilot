-- pgTAP suite for Phase 2 opportunity ingestion: RLS, minimal grants,
-- immutable snapshots, and the atomic import RPC (create-or-dedup).
-- Synthetic fixtures, rolled-back transaction, roles as the app uses them.

begin;

select plan(18);

-- Fixtures: users G and H (the signup trigger creates their profiles).
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('77777777-7777-7777-7777-777777777777',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-g@test.local', 'synthetic', now(), now(), now()),
  ('88888888-8888-8888-8888-888888888888',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-h@test.local', 'synthetic', now(), now(), now());

-- ---------------------------------------------------------------------------
-- 1) anon: zero access.

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.opportunities', '42501',
  null, 'anon cannot read opportunities');
select throws_ok(
  'select count(*) from public.opportunity_snapshots', '42501',
  null, 'anon cannot read snapshots');
select throws_ok(
  $$select public.import_opportunity(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'x', 'paste', 'v1', 'allowed', '{}'::jsonb)$$,
  '42501', null, 'anon cannot execute import_opportunity');
reset role;

-- ---------------------------------------------------------------------------
-- 2) user G: import creates an opportunity + immutable snapshot.

select set_config('request.jwt.claims',
  json_build_object('sub', '77777777-7777-7777-7777-777777777777',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.g_import',
  (select public.import_opportunity(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'Senior Product Designer chez Acme', 'paste', 'paste-extract-1',
      'allowed',
      '{"title":"Senior Product Designer","organization":"Acme",'
      '"engagement_type":"freelance","skills":["Figma"]}'::jsonb)::text),
  false);

select is(
  (current_setting('test.g_import')::jsonb ->> 'created'), 'true',
  'first import creates a new canonical opportunity');
select is(
  (select count(*)::int from public.opportunities), 1,
  'G sees exactly its one opportunity');
select is(
  (select title from public.opportunities), 'Senior Product Designer',
  'the normalized title is stored');
select is(
  (select count(*)::int from public.opportunity_snapshots), 1,
  'a snapshot was captured');
select is(
  (select raw_text from public.opportunity_snapshots),
  'Senior Product Designer chez Acme',
  'the snapshot froze the exact source text');

-- 3) Dedup: same fingerprint → no new canonical row, second snapshot added.
select set_config('test.g_import2',
  (select public.import_opportunity(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'Senior Product Designer chez Acme (reposted)', 'paste',
      'paste-extract-1', 'allowed',
      '{"title":"Senior Product Designer"}'::jsonb)::text),
  false);
select is(
  (current_setting('test.g_import2')::jsonb ->> 'created'), 'false',
  're-importing the same fingerprint does not create a duplicate');
select is(
  (select count(*)::int from public.opportunities), 1,
  'still exactly one canonical opportunity after re-import');
select is(
  (select count(*)::int from public.opportunity_snapshots), 2,
  'the re-import appended a second immutable snapshot');

-- 3b) The DB rejects an oversized list even through the RPC (independent
--     enforcement point, past the app's Zod layer).
select throws_ok(
  $$select public.import_opportunity(
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'oversized', 'paste', 'paste-extract-1', 'allowed',
      jsonb_build_object('skills',
        (select jsonb_agg('x'::text) from generate_series(1, 51))))$$,
  'P0001', null,
  'the DB trigger rejects a list of more than 50 entries via the RPC');

-- 4) Immutability + grant posture: authenticated cannot mutate snapshots,
--    nor insert opportunities directly (only via the RPC).
select throws_ok(
  $$update public.opportunity_snapshots set raw_text = 'tampered'$$,
  '42501', null, 'authenticated has no UPDATE on snapshots (immutable)');
select throws_ok(
  $$insert into public.opportunities (profile_id, canonical_fingerprint)
    values ((select id from public.candidate_profiles
              where user_id = '77777777-7777-7777-7777-777777777777'),
            'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')$$,
  '42501', null, 'authenticated cannot INSERT opportunities directly');

reset role;

-- ---------------------------------------------------------------------------
-- 5) user H: complete isolation from G.

select set_config('request.jwt.claims',
  json_build_object('sub', '88888888-8888-8888-8888-888888888888',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.opportunities), 0,
  'H reads none of G''s opportunities');
select is(
  (select count(*)::int from public.opportunity_snapshots), 0,
  'H reads none of G''s snapshots');

-- H importing the SAME fingerprint creates ITS OWN opportunity (per-owner
-- dedup, not global) — proving import always targets the caller's profile.
select is(
  (select public.import_opportunity(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'H''s own listing', 'paste', 'paste-extract-1',
      'allowed', '{"title":"H listing"}'::jsonb)::jsonb ->> 'created'),
  'true', 'H''s same-fingerprint import creates H''s own opportunity');
select is(
  (select count(*)::int from public.opportunities), 1,
  'H now sees exactly its own single opportunity');

reset role;

select * from finish();

rollback;
