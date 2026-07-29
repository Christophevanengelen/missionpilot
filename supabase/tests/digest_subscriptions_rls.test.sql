-- La RLS de l'abonnement au digest.
--
-- Ce que cette suite protège tient en une phrase : cette table décide À QUI on
-- envoie des e-mails. Une faille d'écriture croisée ne fuiterait aucune donnée
-- — elle ferait écrire MissionPilot à quelqu'un qui n'a rien demandé, sous son
-- propre nom de domaine. C'est le genre de défaut qui se paie en réputation
-- d'expéditeur, donc en liens de connexion qui n'arrivent plus.

begin;
select plan(13);

-- Deux personnes, deux profils.
--
-- `on conflict (user_id) do update` et non un `insert` nu : un déclencheur crée
-- déjà le profil à l'insertion de l'utilisateur. L'insertion nue lève une
-- violation d'unicité, et la suite entière ne s'exécute pas — constaté en CI.
-- La forme ci-dessous est celle qu'emploient les autres suites, et elle a
-- l'avantage de FIXER les identifiants de profil.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

insert into public.candidate_profiles (id, user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Bob')
on conflict (user_id) do update set id = excluded.id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES PRIVILÈGES DE TABLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Avant toute policy : ce que Supabase a pu accorder par défaut. C'est la
-- mécanique exacte de la faille du 2026-07-27, où six tables avaient gardé
-- TRUNCATE parce que personne n'avait écrit `revoke all`.

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_name = 'digest_subscriptions'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'DELETE', 'REFERENCES', 'TRIGGER')),
  0,
  'ni anon ni authenticated ne détiennent TRUNCATE, DELETE, REFERENCES ou TRIGGER'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_name = 'digest_subscriptions' and grantee = 'anon'),
  0,
  'anon ne détient RIEN — le désabonnement passe par la clé secrète, pas par lui'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.digest_subscriptions'::regclass),
  'la RLS est activée'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ALICE PILOTE SON ABONNEMENT
-- ═══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$
  insert into public.digest_subscriptions (profile_id, opted_in, unsubscribe_token)
  values ('aaaaaaaa-0000-0000-0000-000000000001', true, repeat('a', 64))
$$, 'alice pose son propre abonnement');

select is(
  (select count(*)::int from public.digest_subscriptions),
  1,
  'alice voit sa ligne'
);

select lives_ok($$
  update public.digest_subscriptions set opted_in = false
$$, 'alice se désabonne elle-même');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. BOB NE PEUT RIEN CONTRE ALICE — C'EST TOUT L'ENJEU
-- ═══════════════════════════════════════════════════════════════════════════

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.digest_subscriptions),
  0,
  'bob ne voit pas la ligne d''alice'
);

-- L'insertion croisée : abonner quelqu'un d'autre à son insu.
select throws_ok($$
  insert into public.digest_subscriptions (profile_id, opted_in, unsubscribe_token)
  values ('aaaaaaaa-0000-0000-0000-000000000001', true, repeat('b', 64))
$$, '42501', null, 'bob ne peut PAS abonner alice');

-- La mise à jour croisée est invisible plutôt que refusée : `using` filtre les
-- lignes avant que `with check` n'ait son mot à dire. Zéro ligne touchée est
-- la bonne réponse, et c'est ce qu'on vérifie.
select lives_ok($$
  update public.digest_subscriptions set opted_in = true
$$, 'la mise à jour de bob ne lève pas…');

reset role;
reset request.jwt.claims;
select is(
  (select opted_in from public.digest_subscriptions),
  false,
  '…et n''a RIEN changé chez alice'
);

-- Le vol de jeton par lecture : bob ne doit pas pouvoir lire celui d'alice,
-- sans quoi il pourrait la désabonner à volonté.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*)::int from public.digest_subscriptions
    where unsubscribe_token = repeat('a', 64)),
  0,
  'bob ne peut pas lire le jeton d''alice'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LES CONTRAINTES DE LA COLONNE
-- ═══════════════════════════════════════════════════════════════════════════

reset role;
reset request.jwt.claims;

select throws_ok($$
  insert into public.digest_subscriptions (profile_id, unsubscribe_token)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'trop-court')
$$, '23514', null, 'un jeton hors format est refusé par la contrainte');

-- L'opt-in par DÉFAUT est faux. Personne ne reçoit d'e-mail parce qu'une
-- migration en a décidé ainsi.
select is(
  (select column_default from information_schema.columns
    where table_name = 'digest_subscriptions' and column_name = 'opted_in'),
  'false',
  'opted_in vaut false par défaut — opt-in strict'
);

select * from finish();
rollback;
