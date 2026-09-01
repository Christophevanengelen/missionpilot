-- pgTAP suite for Apply Pack L5 application_dispatches: owner-only RLS on every
-- verb, the duplicate guard that refuses the 2026-09-01 incident, the follow-up
-- paths it must NOT refuse, the composite FK on the CV variant, and the
-- coherence checks between a reply and its dispatch.

begin;

select plan(18);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('11110000-2222-3333-4444-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dispatch-owner@test.local', 'synthetic', now(), now(), now()),
  ('22220000-7777-8888-9999-000000000000',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dispatch-other@test.local', 'synthetic', now(), now(), now());

-- anon: no read.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  'select count(*) from public.application_dispatches', '42501',
  null, 'anon cannot read the dispatch register');
reset role;

-- Owner U sets up a profile, an opportunity and a CV variant.
select set_config('request.jwt.claims',
  json_build_object('sub', '11110000-2222-3333-4444-555555555555',
    'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.u_profile',
  (select id from public.candidate_profiles)::text, false);

insert into public.cv_variants
  (profile_id, name, headline, use_when, file_name, language)
values
  (current_setting('test.u_profile')::uuid, 'Service Design',
   'Business & Service Designer',
   'Regulated services: banking, telecom, public sector.',
   'CV_Service_Design.pdf', 'en');

select set_config('test.u_variant',
  (select id from public.cv_variants)::text, false);

select set_config('test.u_import',
  (select public.import_opportunity(
      repeat('7', 64), repeat('8', 64),
      'Business & Service Designer chez Telco', 'paste', 'paste-dispatch-1',
      'allowed',
      '{"title":"Business & Service Designer","organization":"Telco"}'::jsonb)::text),
  false);

select set_config('test.u_opp',
  ((current_setting('test.u_import')::jsonb) ->> 'opportunity_id'), false);

-- A real send, recorded by the human.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel, recipient, cv_variant_id)
values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid,
   'agency', 'recruiter@agency.test',
   current_setting('test.u_variant')::uuid);

select is(
  (select count(*)::int from public.application_dispatches), 1,
  'owner sees its own dispatch');

select is(
  (select delivery from public.application_dispatches), 'unknown',
  'delivery starts unknown: the product does not read the mailbox');

select is(
  (select sent_on from public.application_dispatches),
  (now() at time zone 'UTC')::date,
  'sent_on is derived from sent_at in UTC');

-- THE ASSERTION THIS TABLE EXISTS FOR. Same opportunity, same channel, same
-- day: that is the 2026-09-01 duplicate, and the schema refuses it.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel) values ('%s', '%s', 'agency')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23505', null,
  'a second dispatch the same day on the same channel is refused');

-- …but the guard must not block legitimate work. Another channel, same day:
-- on 2026-09-01 two agencies chased the same Proximus seat.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel) values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid, 'direct');

select is(
  (select count(*)::int from public.application_dispatches), 2,
  'another channel the same day is allowed');

-- …and a follow-up on another day is allowed too.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel, sent_at) values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid, 'agency', now() + interval '8 days');

select is(
  (select count(*)::int from public.application_dispatches), 3,
  'a follow-up on another day is allowed');

-- Closed channel list: prose cannot leak into the funnel dimension.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel) values ('%s', '%s', 'carrier pigeon')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23514', null, 'channel is a closed list');

select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel, delivery)
      values ('%s', '%s', 'portal', 'probably')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23514', null, 'delivery is a closed list');

-- A reply kind without a reply date is an unanchored fact.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel, reply_kind)
      values ('%s', '%s', 'referral', 'interview')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23514', null, 'a reply kind requires a reply date');

-- A reply cannot precede its own dispatch.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel, sent_at, replied_at)
      values ('%s', '%s', 'inbound', now(), now() - interval '1 day')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23514', null, 'a reply cannot precede its dispatch');

-- Recording the bounce: the fact Orbis lacked for four days.
update public.application_dispatches
   set delivery = 'bounced', delivery_checked_at = now()
 where channel = 'direct';

select is(
  (select delivery from public.application_dispatches where channel = 'direct'),
  'bounced', 'owner can record a bounce');

select is(
  (select count(*)::int from public.application_dispatches
    where delivery = 'unknown'), 2,
  'the undelivered query still finds the unverified ones');

-- Deleting the CV variant clears the reference, never the event: the dispatch
-- happened, and that stays true.
delete from public.cv_variants
 where id = current_setting('test.u_variant')::uuid;

select is(
  (select cv_variant_id from public.application_dispatches
    where channel = 'agency' and sent_on = (now() at time zone 'UTC')::date),
  null::uuid, 'deleting a variant clears the reference');

select is(
  (select count(*)::int from public.application_dispatches), 3,
  'deleting a variant never deletes the dispatch');

-- Owner U can delete its own row.
delete from public.application_dispatches
 where channel = 'agency' and sent_on > (now() at time zone 'UTC')::date;
select is(
  (select count(*)::int from public.application_dispatches), 2,
  'owner can delete its own dispatch');

reset role;

-- Other user V sees nothing of U's register.
select set_config('request.jwt.claims',
  json_build_object('sub', '22220000-7777-8888-9999-000000000000',
    'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.application_dispatches), 0,
  'another user sees none of the register');

-- …and cannot attach its own dispatch to U's opportunity.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel)
      values ('%s', '%s', 'direct')$$,
    (select id from public.candidate_profiles
      where user_id = '22220000-7777-8888-9999-000000000000'),
    current_setting('test.u_opp')),
  '23503', null,
  'a dispatch cannot point at another profile''s opportunity');

reset role;

select * from finish();
rollback;
