-- « Pas pour moi » — la seule chose que le produit apprend d'une offre.
--
-- CE QUE CETTE TABLE NE CONTIENT PAS, et c'est sa raison d'être : aucun
-- identifiant d'offre, aucun titre, aucune entreprise, aucune URL. Le produit
-- promet « aucune offre stockée », et un journal des annonces écartées serait
-- exactement le dossier que cette promesse interdit — en négatif. Savoir
-- qu'une personne a rejeté « Directeur technique chez X » en dit autant sur sa
-- recherche que de savoir qu'elle l'a consultée.
--
-- DES COMPTEURS, PAS UN JOURNAL. Une ligne par (profil, motif), incrémentée.
-- Pas d'horodatage par événement : une chronologie « a écarté 3 offres mardi à
-- 22 h » est un profil de comportement, et le produit n'en tient aucun. Les
-- compteurs suffisent à la seule question qui compte — QUEL motif domine —
-- c'est-à-dire en quoi la recherche se trompe.
--
-- POURQUOI EN BASE PLUTÔT QU'EN SESSION. Parce que le motif corrige la
-- recherche SUIVANTE. Un signal qui disparaît à la fermeture de l'onglet
-- demanderait à la personne de réécarter les mêmes offres à chaque visite —
-- c'est-à-dire de faire le travail du moteur.

create table public.offer_dismissals (
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  -- Vocabulaire fermé : un champ libre finirait par contenir du texte de CV,
  -- donc de la donnée personnelle, dans une table qui n'en veut aucune.
  reason text not null check (
    reason in (
      'wrong_role',
      'too_junior',
      'too_senior',
      'wrong_place',
      'wrong_contract'
    )
  ),
  count integer not null default 0 check (count >= 0),
  primary key (profile_id, reason)
);

comment on table public.offer_dismissals is
  'Compteurs de motifs d''écartement. Ne contient AUCUNE référence à une offre : le produit n''en stocke pas.';

alter table public.offer_dismissals enable row level security;

-- LE `revoke all` D'ABORD, et il n'est pas décoratif. Sans lui, la table hérite
-- des privilèges par défaut de Supabase : `anon` ET `authenticated` reçoivent
-- TRUNCATE. C'est exactement le défaut constaté le 2026-07-27 sur six tables —
-- quelqu'un qui ne pouvait LIRE aucune ligne d'autrui pouvait vider la table de
-- tout le monde. Détruire sans jamais pouvoir consulter. `account_deletion`
-- teste cet invariant sur TOUT le schéma public : cette table l'a cassé à sa
-- création, et le test l'a dit.
revoke all on public.offer_dismissals from anon, authenticated;

-- `authenticated` n'a pas besoin de DELETE : un compteur ne se supprime pas, il
-- descend à zéro ou il disparaît avec le profil. Le chemin d'effacement de
-- compte passe par la clé secrète, pas par la session.
grant select, insert, update on public.offer_dismissals to authenticated;
grant select, insert, update, delete on public.offer_dismissals to service_role;

-- La même forme que partout ailleurs : on ne voit et on ne modifie que ce qui
-- pend à son propre profil. La jointure passe par `candidate_profiles.user_id`,
-- seule source de vérité du propriétaire.
create policy "offer_dismissals_select_own"
  on public.offer_dismissals for select
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = offer_dismissals.profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "offer_dismissals_insert_own"
  on public.offer_dismissals for insert
  with check (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = offer_dismissals.profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "offer_dismissals_update_own"
  on public.offer_dismissals for update
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = offer_dismissals.profile_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = offer_dismissals.profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "offer_dismissals_delete_own"
  on public.offer_dismissals for delete
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = offer_dismissals.profile_id and p.user_id = (select auth.uid())
    )
  );

-- L'incrément atomique. Écrit en SQL plutôt qu'en deux requêtes côté
-- application : deux clics rapprochés sur deux offres liraient le même
-- compteur et en perdraient un.
create or replace function public.ecarter_offre(p_profile_id uuid, p_reason text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  nouveau integer;
begin
  insert into public.offer_dismissals (profile_id, reason, count)
  values (p_profile_id, p_reason, 1)
  on conflict (profile_id, reason)
  do update set count = public.offer_dismissals.count + 1
  returning count into nouveau;
  return nouveau;
end;
$$;

comment on function public.ecarter_offre(uuid, text) is
  'Incrémente atomiquement un compteur de motif. `security invoker` : la RLS ci-dessus reste la garde.';

-- Une fonction est exécutable par PUBLIC par défaut. Ici c'est sans danger —
-- elle est `security invoker`, donc la RLS refuse l'écriture croisée de toute
-- façon — mais on ne laisse pas `anon` détenir un droit dont il n'a aucun
-- usage : la surface se réduit d'abord, elle s'argumente ensuite.
revoke all on function public.ecarter_offre(uuid, text) from public, anon;
grant execute on function public.ecarter_offre(uuid, text) to authenticated, service_role;
