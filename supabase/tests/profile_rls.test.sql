-- pgTAP suite for the Phase 1 profile/evidence schema: RLS, minimal grants,
-- lifecycle invariants and the atomic publish/restore functions.
-- Same conventions as rls_policies.test.sql: synthetic fixtures only
-- (test.local, fixed UUIDs), rolled-back transaction, roles exercised exactly
-- as the app would (anon / authenticated / service_role).

begin;

select plan(53);

-- ---------------------------------------------------------------------------
-- Fixtures: users C and D (the signup trigger creates their profiles).

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-c@test.local', 'synthetic', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-d@test.local', 'synthetic', now(), now(), now());

-- ---------------------------------------------------------------------------
-- 1) anon: zero access, tables and functions alike.

set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  'select count(*) from public.profile_claims', '42501',
  null, 'anon cannot read profile_claims');
select throws_ok(
  'select count(*) from public.evidence_items', '42501',
  null, 'anon cannot read evidence_items');
select throws_ok(
  'select count(*) from public.claim_evidence_links', '42501',
  null, 'anon cannot read claim_evidence_links');
select throws_ok(
  'select count(*) from public.profile_versions', '42501',
  null, 'anon cannot read profile_versions');
select throws_ok(
  $$select public.publish_profile_version(
      '33333333-3333-3333-3333-333333333333'::uuid,
      '{}'::jsonb, repeat('a', 64), 'x')$$,
  '42501', null, 'anon cannot execute publish');
select throws_ok(
  $$select public.restore_profile_version(
      '33333333-3333-3333-3333-333333333333'::uuid,
      gen_random_uuid(), 'x')$$,
  '42501', null, 'anon cannot execute restore');
select throws_ok(
  $$select public.replace_profile_claim(
      '33333333-3333-3333-3333-333333333333'::uuid,
      'role', '{"title":"x"}'::jsonb)$$,
  '42501', null, 'anon cannot execute replace_profile_claim');

reset role;

-- ---------------------------------------------------------------------------
-- 2) user C: claims lifecycle under RLS + column grants.

select set_config('request.jwt.claims',
  json_build_object(
    'sub', '33333333-3333-3333-3333-333333333333',
    'role', 'authenticated')::text,
  true);
set local role authenticated;

select lives_ok(
  $$select public.replace_profile_claim(
      (select id from public.candidate_profiles
        where user_id = '33333333-3333-3333-3333-333333333333'),
      'role', '{"title":"Product Designer"}'::jsonb)$$,
  'C proposes a role claim');

select is(
  (select count(*)::int from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.kind = 'role' and c.superseded_at is null),
  1, 'exactly one active role claim');

select lives_ok(
  $$select public.replace_profile_claim(
      (select id from public.candidate_profiles
        where user_id = '33333333-3333-3333-3333-333333333333'),
      'role', '{"title":"Lead Product Designer"}'::jsonb)$$,
  'a correction replaces the role claim');

select is(
  (select count(*)::int from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.kind = 'role' and c.superseded_at is null),
  1, 'still exactly one active role claim after correction');

select is(
  (select count(*)::int from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.kind = 'role' and c.superseded_by_claim_id is not null),
  1, 'the replaced claim is explicitly closed with a successor');

select is(
  (select (c.previous_claim_id is not null) from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.kind = 'role' and c.superseded_at is null),
  true, 'the new claim chains to its predecessor');

select throws_ok(
  $$update public.profile_claims
      set value = '{"title":"tampered"}'::jsonb
      where kind = 'role' and superseded_at is null$$,
  '42501', null, 'claim values are append-only for users (no value grant)');

select lives_ok(
  $$update public.profile_claims set state = 'confirmed'
      where kind = 'role' and superseded_at is null and state = 'proposed'$$,
  'C can decide the lifecycle state of an active claim');

-- Multi-valued kinds: two active skills are legal; a second active
-- single-valued claim is not.
select lives_ok(
  $$insert into public.profile_claims (profile_id, kind, value)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            'skill', '{"name":"UX"}'::jsonb)$$,
  'C adds a first skill');
select lives_ok(
  $$insert into public.profile_claims (profile_id, kind, value)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            'skill', '{"name":"Design system"}'::jsonb)$$,
  'two active skills may coexist');
select throws_ok(
  $$insert into public.profile_claims (profile_id, kind, value)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            'role', '{"title":"Second"}'::jsonb)$$,
  '23505', null, 'a second ACTIVE single-valued claim is rejected');

-- ---------------------------------------------------------------------------
-- 3) user C: evidence honesty + links traceability.

select lives_ok(
  $$insert into public.evidence_items
      (profile_id, type, title, statement, source_type, verification_status)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            'achievement', 'Refonte du checkout', '+18 % de conversion',
            'user_stated', 'user_confirmed')$$,
  'C records a user_confirmed evidence');

select throws_ok(
  $$insert into public.evidence_items
      (profile_id, type, title, statement, source_type, verification_status)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            'credential', 'Fake badge', 'x', 'user_stated',
            'externally_verified')$$,
  '42501', null, 'users can never self-grant externally_verified');

select throws_ok(
  $$update public.evidence_items
      set verification_status = 'externally_verified'
      where title = 'Refonte du checkout'$$,
  '42501', null, 'nor upgrade verification later');

select lives_ok(
  $$insert into public.claim_evidence_links (claim_id, evidence_id)
    values (
      (select c.id from public.profile_claims c
        join public.candidate_profiles p on p.id = c.profile_id
        where p.user_id = '33333333-3333-3333-3333-333333333333'
          and c.kind = 'role' and c.superseded_at is null),
      (select id from public.evidence_items
        where title = 'Refonte du checkout'))$$,
  'C attaches own evidence to own claim');

select throws_ok(
  $$insert into public.claim_evidence_links (claim_id, evidence_id)
    values (
      (select c.id from public.profile_claims c
        join public.candidate_profiles p on p.id = c.profile_id
        where p.user_id = '33333333-3333-3333-3333-333333333333'
          and c.kind = 'role' and c.superseded_at is null),
      (select id from public.evidence_items
        where title = 'Refonte du checkout'))$$,
  '23505', null, 'no duplicate ACTIVE link for the same pair');

select lives_ok(
  $$update public.claim_evidence_links
      set detached_at = now(), detach_reason = 'test de détachement'
      where detached_at is null$$,
  'detaching stamps the link instead of deleting it');

select is(
  (select count(*)::int from public.claim_evidence_links),
  1, 'the detached link is preserved (history survives)');

select lives_ok(
  $$insert into public.claim_evidence_links (claim_id, evidence_id)
    values (
      (select c.id from public.profile_claims c
        join public.candidate_profiles p on p.id = c.profile_id
        where p.user_id = '33333333-3333-3333-3333-333333333333'
          and c.kind = 'role' and c.superseded_at is null),
      (select id from public.evidence_items
        where title = 'Refonte du checkout'))$$,
  're-attaching after a detach is allowed');

-- ---------------------------------------------------------------------------
-- 4) versions: publication contract (atomic function only).

select throws_ok(
  $$insert into public.profile_versions
      (profile_id, version_number, content, content_hash, change_summary)
    values ((select id from public.candidate_profiles
              where user_id = '33333333-3333-3333-3333-333333333333'),
            1, '{}'::jsonb, repeat('a', 64), 'direct')$$,
  '42501', null, 'users cannot insert versions directly');

select is(
  (public.publish_profile_version(
     (select id from public.candidate_profiles
       where user_id = '33333333-3333-3333-3333-333333333333'),
     jsonb_build_object('schema_version', 1, 'claims', jsonb_build_array(
       jsonb_build_object(
         'kind', 'role',
         'value', jsonb_build_object('title', 'Lead Product Designer'),
         'evidence', jsonb_build_array(jsonb_build_object(
           'evidence_id',
           (select id from public.evidence_items
             where title = 'Refonte du checkout'))))
     )),
     repeat('1', 64), 'Première version publiée du profil.')
   ->> 'created')::boolean,
  true, 'first publish creates a version');

select is(
  (select max(version_number)::int from public.profile_versions),
  1, 'the first version is number 1');

select is(
  (select p.current_version_id = v.id
    from public.candidate_profiles p
    join public.profile_versions v on v.profile_id = p.id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and v.version_number = 1),
  true, 'current_version_id points at the new head');

select is(
  (public.publish_profile_version(
     (select id from public.candidate_profiles
       where user_id = '33333333-3333-3333-3333-333333333333'),
     '{"schema_version":1,"claims":[]}'::jsonb,
     repeat('1', 64), 'double clic')
   ->> 'created')::boolean,
  false, 'identical consecutive content publishes nothing (idempotent)');

select is(
  (select count(*)::int from public.profile_versions),
  1, 'no duplicate row after the idempotent retry');

select is(
  (public.publish_profile_version(
     (select id from public.candidate_profiles
       where user_id = '33333333-3333-3333-3333-333333333333'),
     '{"schema_version":1,"claims":[]}'::jsonb,
     repeat('2', 64), 'Résumé mis à jour.')
   ->> 'version_number')::int,
  2, 'changed content becomes version 2');

select throws_ok(
  $$select public.publish_profile_version(
      (select id from public.candidate_profiles
        where user_id = '33333333-3333-3333-3333-333333333333'),
      '{}'::jsonb, 'not-a-hash', 'x')$$,
  'P0001', null, 'a malformed hash is refused');

select throws_ok(
  $$select public.publish_profile_version(
      (select id from public.candidate_profiles
        where user_id = '33333333-3333-3333-3333-333333333333'),
      '{}'::jsonb, repeat('3', 64), '   ')$$,
  'P0001', null, 'an empty change summary is refused');

select throws_ok(
  $$update public.profile_versions set change_summary = 'rewrite'$$,
  '42501', null, 'authenticated cannot update any version');

select throws_ok(
  $$delete from public.profile_versions$$,
  '42501', null, 'authenticated cannot delete any version');

-- ---------------------------------------------------------------------------
-- 5) restore: rebuilds claims from the snapshot, new traceable version.

select is(
  (public.restore_profile_version(
     (select id from public.candidate_profiles
       where user_id = '33333333-3333-3333-3333-333333333333'),
     (select id from public.profile_versions where version_number = 1),
     'Restauration de la version 1.')
   ->> 'version_number')::int,
  3, 'restoring creates a NEW version (never reactivates the old one)');

select is(
  (select v3.created_from_version_id = v1.id
    from public.profile_versions v3, public.profile_versions v1
    where v3.version_number = 3 and v1.version_number = 1),
  true, 'the restored version records its source');

select is(
  (select count(*)::int from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.superseded_at is null),
  1, 'the living claims now mirror the v1 snapshot (one claim)');

select is(
  (select c.state from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
      and c.superseded_at is null),
  'confirmed', 'restored claims are confirmed facts');

select is(
  (select count(*)::int from public.claim_evidence_links l
    join public.profile_claims c on c.id = l.claim_id
    where c.superseded_at is null and l.detached_at is null),
  1, 'the snapshot evidence link was re-attached');

select is(
  (public.restore_profile_version(
     (select id from public.candidate_profiles
       where user_id = '33333333-3333-3333-3333-333333333333'),
     (select id from public.profile_versions where version_number = 2),
     'Restauration de la version 2.')
   ->> 'missing_evidence')::int,
  0, 'restoring an evidence-free snapshot reports zero misses');

-- History-shape guard (chain-integrity trigger), still as C: a closed claim
-- can never be silently reopened.
select throws_ok(
  $$update public.profile_claims set superseded_at = null
      where superseded_at is not null$$,
  'P0001', null, 'a closed claim cannot be reopened');

reset role;

-- Capture C's profile id as a setting so the next section can attack it with
-- a REAL foreign id (not an RLS-nulled subquery).
select set_config('test.c_profile_id',
  (select id::text from public.candidate_profiles
    where user_id = '33333333-3333-3333-3333-333333333333'),
  true);
select set_config('test.c_claim_id',
  (select c.id::text from public.profile_claims c
    join public.candidate_profiles p on p.id = c.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'
    limit 1),
  true);

-- ---------------------------------------------------------------------------
-- 6) user D: complete isolation from C.

select set_config('request.jwt.claims',
  json_build_object(
    'sub', '44444444-4444-4444-4444-444444444444',
    'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*)::int from public.profile_claims),
  0, 'D reads none of C''s claims');
select is(
  (select count(*)::int from public.evidence_items),
  0, 'D reads none of C''s evidence');
select is(
  (select count(*)::int from public.profile_versions),
  0, 'D reads none of C''s versions');

select throws_ok(
  $$insert into public.profile_claims (profile_id, kind, value)
    values (current_setting('test.c_profile_id')::uuid,
            'skill', '{"name":"intrusion"}'::jsonb)$$,
  '42501', null, 'D cannot write into C''s profile (real foreign id)');

select throws_ok(
  $$select public.publish_profile_version(
      current_setting('test.c_profile_id')::uuid,
      '{}'::jsonb, repeat('9', 64), 'intrusion')$$,
  '42501', null,
  'publish refuses a non-owner even with the REAL foreign profile id');

select throws_ok(
  $$select public.restore_profile_version(
      current_setting('test.c_profile_id')::uuid,
      gen_random_uuid(), 'intrusion')$$,
  '42501', null, 'restore refuses a non-owner with the real foreign id');

select throws_ok(
  $$select public.restore_profile_version(
      null, gen_random_uuid(), 'intrusion')$$,
  '42501', null, 'restore refuses null profiles');

-- A supersede target belonging to C (a REAL existing foreign claim id) is
-- refused for D's own profile: no cross-profile chain reference, and the
-- refusal is identical to a nonexistent id — no claim-id existence oracle.
select throws_ok(
  $$select public.replace_profile_claim(
      (select id from public.candidate_profiles
        where user_id = '44444444-4444-4444-4444-444444444444'),
      'role', '{"title":"x"}'::jsonb, 'user',
      current_setting('test.c_claim_id')::uuid)$$,
  'P0001', null,
  'an explicit supersede target from another profile is refused');

reset role;

-- ---------------------------------------------------------------------------
-- 7) even service_role cannot rewrite history (no UPDATE grant at all).

set local role service_role;
select throws_ok(
  $$update public.profile_versions set change_summary = 'rewrite'$$,
  '42501', null, 'service_role has no UPDATE on versions either');
reset role;

select * from finish();

rollback;
