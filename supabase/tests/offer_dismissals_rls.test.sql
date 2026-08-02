-- La RLS des motifs d'écartement.
--
-- Ce que cette suite protège : ces compteurs disent en quoi la recherche de
-- quelqu'un se trompe — donc, indirectement, ce qu'il cherche. « Trop junior,
-- douze fois » se lit très bien. Une lecture croisée n'exposerait pas une
-- offre, mais l'état d'esprit d'une recherche d'emploi, ce qui n'est pas moins
-- personnel.
--
-- Et une garantie qui n'est pas une policy : la table N'A PAS de colonne
-- pouvant désigner une offre. C'est vérifié ici aussi, parce qu'une promesse
-- produit qui ne tient qu'à la discipline d'un futur `alter table` ne tient à
-- rien.

begin;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

-- `on conflict (user_id) do update` : un déclencheur crée déjà le profil à
-- l'insertion de l'utilisateur. L'insertion nue lève une violation d'unicité
-- et la suite entière s'arrête. Même forme que les autres suites.
insert into public.candidate_profiles (id, user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Bob')
on conflict (user_id) do update set id = excluded.id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA TABLE NE PEUT PAS DÉSIGNER UNE OFFRE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La promesse « aucune offre stockée » vaut ce que vaut le schéma. Ce test
-- échouera le jour où quelqu'un ajoutera `offer_url` « juste pour déboguer ».

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'offer_dismissals'),
  3,
  'exactement trois colonnes : profil, motif, compteur'
);

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'offer_dismissals'
      and column_name ~ '(offer|job|url|title|company|external)'),
  0,
  'aucune colonne ne peut désigner une offre — la promesse est dans le schéma'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.offer_dismissals'::regclass),
  'la RLS est activée'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_name = 'offer_dismissals' and grantee = 'anon'),
  0,
  'anon ne détient rien'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_name = 'offer_dismissals'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')),
  0,
  'ni TRUNCATE, ni REFERENCES, ni TRIGGER'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ALICE ÉCARTE, ET LE COMPTEUR MONTE
-- ═══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.ecarter_offre('aaaaaaaa-0000-0000-0000-000000000001', 'too_junior'),
  1,
  'le premier écartement crée le compteur à 1'
);

select is(
  public.ecarter_offre('aaaaaaaa-0000-0000-0000-000000000001', 'too_junior'),
  2,
  'le second incrémente au lieu de dupliquer la ligne'
);

select is(
  (select count(*)::int from public.offer_dismissals),
  1,
  'une seule ligne par (profil, motif)'
);

select is(
  public.ecarter_offre('aaaaaaaa-0000-0000-0000-000000000001', 'wrong_place'),
  1,
  'un autre motif ouvre son propre compteur'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. BOB NE PEUT NI LIRE NI ÉCRIRE CHEZ ALICE
-- ═══════════════════════════════════════════════════════════════════════════

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.offer_dismissals),
  0,
  'bob ne voit aucun compteur d''alice'
);

-- `security invoker` : la fonction s'exécute avec les droits de bob, donc la
-- policy d'insertion la refuse. Une fonction `security definer` aurait ici
-- contourné toute la RLS — c'est précisément pourquoi elle ne l'est pas.
select throws_ok($$
  select public.ecarter_offre('aaaaaaaa-0000-0000-0000-000000000001', 'wrong_role')
$$, '42501', null, 'bob ne peut PAS écarter au nom d''alice');

reset role;
reset request.jwt.claims;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LE VOCABULAIRE EST FERMÉ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un champ libre finirait par contenir du texte de CV — donc de la donnée
-- personnelle, dans une table conçue pour n'en porter aucune.

select throws_ok($$
  insert into public.offer_dismissals (profile_id, reason, count)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'je cherche autre chose', 1)
$$, '23514', null, 'un motif hors vocabulaire est refusé par la contrainte');

select throws_ok($$
  insert into public.offer_dismissals (profile_id, reason, count)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'too_senior', -1)
$$, '23514', null, 'un compteur négatif est refusé');

-- L'effacement du compte doit emporter les compteurs : ils pendent au profil.
delete from public.candidate_profiles
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.offer_dismissals),
  0,
  'effacer le profil efface ses compteurs (on delete cascade)'
);

select * from finish();
rollback;
