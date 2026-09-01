-- pgTAP suite for Apply Pack L5 application_dispatches: owner-only RLS on every
-- verb, the duplicate guard that refuses the 2026-09-01 incident, the follow-up
-- paths it must NOT refuse, the composite FK on the CV variant, and the
-- coherence checks between a reply and its dispatch.

begin;

select plan(25);

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

-- THE ASSERTION THIS TABLE EXISTS FOR. Same recipient, same opportunity, same
-- channel, same day: that is the 2026-09-01 duplicate, and the schema refuses
-- it.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel, recipient)
      values ('%s', '%s', 'agency', 'recruiter@agency.test')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23505', null,
  'the same letter to the same recipient the same day is refused');

-- Le destinataire est du texte libre saisi à la main : sans normalisation,
-- « recruiter@agency.test » et « Recruiter@Agency.test  » seraient deux
-- événements, et le doublon passerait sous la contrainte censée l'attraper.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel, recipient)
      values ('%s', '%s', 'agency', '  Recruiter@Agency.TEST  ')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23505', null,
  'casing and padding do not create a second event');

-- …and the guard must not block legitimate work. THE CASE THAT CAUGHT ME OUT:
-- on 2026-09-01 two agencies chased the same Proximus seat. Without `recipient`
-- in the key, this insert failed — the constraint refused an envoi that really
-- happened, which is the original incident by the other end.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel, recipient) values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid, 'agency', 'other@agency.test');

select is(
  (select count(*)::int from public.application_dispatches), 2,
  'a second agency on the same mandate the same day is allowed');

-- Two portal deposits with no named recipient are NOT two events: `nulls not
-- distinct` treats them as the same. If the person can tell them apart, they
-- name the recipient.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel) values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid, 'portal');

select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel) values ('%s', '%s', 'portal')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '23505', null,
  'two nameless deposits the same day count as one (nulls not distinct)');

-- …and a follow-up on another day is allowed too.
insert into public.application_dispatches
  (profile_id, opportunity_id, channel, sent_at) values
  (current_setting('test.u_profile')::uuid,
   current_setting('test.u_opp')::uuid, 'agency', now() + interval '8 days');

select is(
  (select count(*)::int from public.application_dispatches), 4,
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
 where channel = 'portal';

select is(
  (select delivery from public.application_dispatches where channel = 'portal'),
  'bounced', 'owner can record a bounce');

select is(
  (select count(*)::int from public.application_dispatches
    where delivery = 'unknown'), 3,
  'the undelivered query still finds the unverified ones');

-- Deleting the CV variant clears the reference, never the event: the dispatch
-- happened, and that stays true.
delete from public.cv_variants
 where id = current_setting('test.u_variant')::uuid;

select is(
  (select cv_variant_id from public.application_dispatches
    where recipient = 'recruiter@agency.test'),
  null::uuid, 'deleting a variant clears the reference');

select is(
  (select count(*)::int from public.application_dispatches), 4,
  'deleting a variant never deletes the dispatch');

-- Owner U can delete its own row.
delete from public.application_dispatches
 where sent_on > (now() at time zone 'UTC')::date;
select is(
  (select count(*)::int from public.application_dispatches), 3,
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

-- LA POLICY LA PLUS DANGEREUSE DE LA TABLE. Sans cette assertion, un
-- `with check (true)` sur l'INSERT ne ferait tomber AUCUN des autres tests :
-- ils prouvent tous le chemin positif, et le seul chemin négatif couvert était
-- la lecture. Un registre où n'importe qui peut écrire dans le profil d'un
-- autre est pire qu'un registre absent.
select throws_ok(
  format(
    $$insert into public.application_dispatches
        (profile_id, opportunity_id, channel) values ('%s', '%s', 'direct')$$,
    current_setting('test.u_profile'), current_setting('test.u_opp')),
  '42501', null,
  'V cannot write a dispatch inside U''s profile');

select lives_ok(
  $$update public.application_dispatches set delivery = 'delivered'$$,
  'V''s blanket update raises no error');

select lives_ok(
  $$delete from public.application_dispatches$$,
  'V''s blanket delete raises no error');

-- LES DEUX ASSERTIONS PRÉCÉDENTES NE PROUVENT RIEN SEULES. `lives_ok` ne
-- constate que l'absence d'erreur : elles passeraient à l'identique si une
-- policy permissive avait laissé V écraser puis supprimer les lignes de U.
-- C'est le contrôle qui manque, et il doit se faire hors RLS.
reset role;

select is(
  (select count(*)::int from public.application_dispatches), 3,
  'U''s dispatches survived V''s blanket delete');

select is(
  (select count(*)::int from public.application_dispatches
    where delivery = 'delivered'), 0,
  'U''s dispatches were not touched by V''s blanket update');

set local role authenticated;

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
