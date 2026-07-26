-- RLS for profile_clarifications: a clarification is an answer someone gave
-- about their own career. Nobody else reads it, and nobody else writes one.
--
-- The suite covers REFUSALS, not just permissions: a policy that grants
-- correctly and denies nothing is not a policy.

begin;
select plan(9);

-- Two owners, each with a profile.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

insert into public.candidate_profiles (id, user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'A'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'B')
on conflict (user_id) do update set id = excluded.id;

insert into public.profile_clarifications
  (profile_id, question_key, question, origin, answer, settled_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:role',
   'Quel métier exercez-vous aujourd''hui ?', 'gap', 'Service Designer', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gap:role',
   'Quel métier exercez-vous aujourd''hui ?', 'gap', 'Data Engineer', now());

-- ---------------------------------------------------------------- anonymous
-- Stronger than an empty result: anon holds no grant on the table at all, so
-- the read is refused before RLS is even consulted.
set local role anon;
select throws_ok(
  $$select id from public.profile_clarifications$$,
  '42501',
  null,
  'anonymous cannot read clarifications — no grant, not merely no rows'
);

-- ------------------------------------------------------------------- owner A
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.profile_clarifications),
  1,
  'owner A sees exactly their own clarification'
);
select is(
  (select answer from public.profile_clarifications),
  'Service Designer',
  'and it is theirs, not B''s'
);
select lives_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, answer, settled_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:seniority',
            'À quel niveau vous situez-vous ?', 'gap', 'Senior', now())$$,
  'owner A can record their own answer'
);
select throws_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, answer, settled_at)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'gap:years',
            'Combien d''années ?', 'gap', '9', now())$$,
  '42501',
  null,
  'owner A cannot write a clarification onto B''s profile'
);

-- The escape hatch is representable: skipped, with no answer.
select lives_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, skipped, settled_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:remote',
            'Le télétravail ?', 'gap', true, now())$$,
  'a skip is a first-class recorded outcome'
);

-- A row can never be both answered and skipped, nor settled without a date.
select throws_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, answer, skipped, settled_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:x',
            'x ?', 'gap', 'oui', true, now())$$,
  '23514',
  null,
  'answered AND skipped is refused by the check constraint'
);
select throws_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, answer)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:y',
            'y ?', 'gap', 'oui')$$,
  '23514',
  null,
  'an answer with no settled_at is refused'
);

-- Asking the same thing twice collapses onto one row.
select throws_ok(
  $$insert into public.profile_clarifications
      (profile_id, question_key, question, origin, answer, settled_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'gap:role',
            'Quel métier ?', 'gap', 'Autre chose', now())$$,
  '23505',
  null,
  'the same question cannot be recorded twice for one profile'
);

select * from finish();
rollback;
