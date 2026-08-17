-- L'effacement de compte, au niveau où il se joue vraiment : la base.
--
-- Ces tests couvrent trois choses distinctes, et la troisième est la plus
-- importante parce qu'elle est celle qu'on oubliera :
--
--   1. La faille TRUNCATE est fermée — et le reste.
--   2. Supprimer `auth.users` efface RÉELLEMENT tout, y compris ce qu'aucune
--      cascade n'atteint et ce qu'aucun `delete` n'autorise.
--   3. Toute table de `public` porte un chemin vers `auth.users`. C'est le
--      test qui échouera le jour où quelqu'un ajoutera une table sans y penser,
--      et c'est exactement à ce moment-là qu'il faut le savoir — pas le jour
--      où une personne exerce son droit et où l'on découvre un résidu.

begin;
select plan(22);

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LE DÉFAUT EXPLOITABLE — TRUNCATE n'est pas filtré par la RLS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Six tables des phases 5 et 6 ont été créées sans le
-- `revoke all ... from anon, authenticated` appliqué partout ailleurs. Elles
-- ont donc conservé les privilèges par défaut de Supabase : `anon` ET
-- `authenticated` détenaient TRUNCATE. Constaté avant correction : un
-- utilisateur qui ne pouvait LIRE aucune ligne d'un autre pouvait tout de même
-- vider la table de TOUT LE MONDE. Détruire sans jamais pouvoir consulter.

select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'TRUNCATE'),
  0,
  'aucun rôle client ne détient TRUNCATE sur une table de public'
);

select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'),
  0,
  'anon ne détient aucun privilège sur aucune table de public'
);

-- La contrepartie fonctionnelle du même oubli : `service_role` se retrouvait
-- SANS AUCUN droit DML sur ces six tables. Tout chemin serveur les touchant
-- échouait en 42501.
select is(
  (select count(*)::int
     from unnest(array['ai_match_insights','ai_match_breakdowns',
                       'ai_application_drafts','ai_interview_briefs',
                       'opportunity_tracking','profile_clarifications']) as t(nom)
    where not exists (
      select 1 from information_schema.role_table_grants g
       where g.table_schema = 'public' and g.table_name = t.nom
         and g.grantee = 'service_role' and g.privilege_type = 'DELETE')),
  0,
  'service_role peut supprimer dans les six tables des phases 5 et 6'
);

-- Épreuve directe plutôt que lecture de catalogue : la faille elle-même.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@test.local');

insert into public.profile_clarifications
  (profile_id, question_key, question, origin, answer, settled_at)
select id, 'gap:role', 'Quel métier ?', 'gap', 'Réponse privée d''Alice', now()
  from public.candidate_profiles
 where user_id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is(
  (select count(*)::int from public.profile_clarifications),
  0,
  'Mallory ne lit aucune ligne d''Alice — la RLS fait son travail en lecture'
);
select throws_ok(
  $$truncate table public.profile_clarifications$$,
  '42501',
  null,
  'et Mallory ne peut PAS vider la table de tout le monde — TRUNCATE refusé'
);
reset role;

select is(
  (select count(*)::int from public.profile_clarifications),
  1,
  'la réponse d''Alice a survécu à la tentative'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE DÉFAUT BLOQUANT — le lignage des versions traversait deux profils
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `created_from_version_id` référençait `profile_versions(id)` sans clause
-- `on delete`, donc en `no action` : une version du profil A descendant d'une
-- version du profil B rendait la suppression de B impossible — erreur 23503,
-- au dernier moment, sur l'écran de quelqu'un qui vient de confirmer.

select is(
  (select pg_get_constraintdef(oid)
     from pg_constraint
    where conrelid = 'public.profile_versions'::regclass
      and conname = 'profile_versions_created_from_version_id_fkey'),
  'FOREIGN KEY (profile_id, created_from_version_id) REFERENCES profile_versions(profile_id, id)',
  'le lignage des versions est composite : une version ne descend que du même profil'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LA GARANTIE STRUCTURELLE — tout chemin mène à auth.users
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le test qui échouera le jour où une table sera ajoutée sans chemin de
-- cascade. Règle : toute table de `public` doit atteindre `auth.users` par des
-- clés étrangères `on delete cascade`. Si une exception devient nécessaire, elle
-- s'inscrit ICI, en connaissance de cause, et pas en silence.
select is(
  (with recursive relie(nom) as (
     select c.conrelid::regclass::text
       from pg_constraint c
      where c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
        and c.confdeltype = 'c'
        and c.connamespace = 'public'::regnamespace
     union
     select c.conrelid::regclass::text
       from pg_constraint c
       join relie r on r.nom = c.confrelid::regclass::text
      where c.contype = 'f'
        and c.confdeltype = 'c'
        and c.connamespace = 'public'::regnamespace
   )
   select coalesce(string_agg(t.tablename, ', ' order by t.tablename), '')
     from pg_tables t
    where t.schemaname = 'public'
      -- EXCEPTION INSCRITE (17/08/2026) : billing_events est le journal brut
      -- d'idempotence des webhooks Polar — aucune colonne utilisateur, donc
      -- aucun chemin de cascade possible. Les données de facturation d'une
      -- personne vivent chez Polar (Merchant of Record) ; si un payload doit
      -- un jour être purgé nominativement, ce sera par un traitement dédié,
      -- pas par cascade. Décision à confirmer par Christophe (RGPD).
      and t.tablename <> 'billing_events'
      and t.tablename not in (select nom from relie)),
  '',
  'toute table de public atteint auth.users par une cascade — aucune orpheline'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. L'EFFACEMENT LUI-MÊME
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.profile_claims (profile_id, kind, value, state, origin)
select id, 'role', '{"title":"Service Designer"}', 'confirmed', 'user'
  from public.candidate_profiles
 where user_id = '11111111-1111-1111-1111-111111111111';

insert into public.agent_runs
  (user_id, workflow_name, workflow_version, status, correlation_id)
values ('11111111-1111-1111-1111-111111111111', 'w', 1, 'completed', 'corr-alice');

insert into public.agent_steps (run_id, step_name, attempt, status)
select id, 'etape', 1, 'completed'
  from public.agent_runs where correlation_id = 'corr-alice';

-- Les résidus du schéma `auth` : aucune clé étrangère vers `auth.users`, donc
-- aucune cascade ne les atteint. `audit_log_entries` porte l'adresse e-mail ET
-- l'adresse IP.
insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        '{"action":"login","actor_id":"11111111-1111-1111-1111-111111111111",
          "actor_username":"alice@test.local"}', now(), '81.240.12.7'),
       -- Entrée écrite AVANT l'existence du compte : elle ne porte pas
       -- d'identifiant, seulement l'adresse. C'est pourquoi le trigger a besoin
       -- de `old.email`, introuvable après la suppression.
       ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        '{"action":"user_repeated_signup",
          "traits":{"user_email":"alice@test.local"}}', now(), '81.240.12.7');

insert into auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'jeton-hors-session',
        '11111111-1111-1111-1111-111111111111', false, now(), now());

-- État de départ, pour qu'un zéro final signifie « effacé » et non
-- « jamais écrit » — la façon la plus facile de faire passer ce test à tort.
select is((select count(*)::int from public.candidate_profiles
            where user_id = '11111111-1111-1111-1111-111111111111'), 1,
          'départ : le profil d''Alice existe');
select is((select count(*)::int from public.profile_claims), 1,
          'départ : son affirmation existe');
select is((select count(*)::int from public.agent_runs), 1,
          'départ : sa trace d''exécution existe');
select is((select count(*)::int from auth.audit_log_entries
            where payload::text like '%alice@test.local%'), 2,
          'départ : deux entrées d''audit la nomment, avec son adresse IP');
select is((select count(*)::int from auth.refresh_tokens
            where user_id = '11111111-1111-1111-1111-111111111111'), 1,
          'départ : un jeton hors session existe');

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.candidate_profiles
            where user_id = '11111111-1111-1111-1111-111111111111'), 0,
          'le profil est parti');
select is((select count(*)::int from public.profile_claims), 0,
          'les affirmations sont parties');
select is((select count(*)::int from public.profile_clarifications), 0,
          'les réponses aux questions sont parties');

-- Le point qui contredit un commentaire de migration, et qu'il faut donc
-- affirmer explicitement : `agent_runs` et `agent_steps` n'accordent AUCUN
-- `delete`, pas même à `service_role`. La cascade passe outre, parce qu'elle
-- s'exécute sous l'identité du propriétaire de la table et non de l'appelant.
-- C'est voulu. Ne pas « réparer » en découplant la clé étrangère.
select is((select count(*)::int from public.agent_runs), 0,
          'les traces d''exécution partent, malgré l''absence de droit DELETE');
select is((select count(*)::int from public.agent_steps), 0,
          'leurs étapes aussi');

-- Ce que le trigger ajoute à la cascade.
select is((select count(*)::int from auth.audit_log_entries
            where payload::text like '%alice@test.local%'), 0,
          'les entrées d''audit — adresse e-mail ET adresse IP — sont purgées');
select is((select count(*)::int from auth.flow_state
            where user_id = '11111111-1111-1111-1111-111111111111'), 0,
          'les états de flux sont purgés');
select is((select count(*)::int from auth.refresh_tokens
            where user_id = '11111111-1111-1111-1111-111111111111'), 0,
          'le jeton hors session est purgé — la cascade des sessions ne l''atteint pas');

-- Et le voisin n'a rien perdu. Un effacement qui déborde est aussi grave qu'un
-- effacement qui laisse des restes.
select is((select count(*)::int from public.candidate_profiles
            where user_id = '22222222-2222-2222-2222-222222222222'), 1,
          'le compte de Mallory est intact — l''effacement ne déborde pas');

select * from finish();
rollback;
