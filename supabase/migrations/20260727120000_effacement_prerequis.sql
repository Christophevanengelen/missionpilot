-- Prérequis de l'effacement de compte (droit à l'effacement, art. 17 RGPD).
--
-- Aucune interface ici : cette migration rend la suppression POSSIBLE et SÛRE.
-- Elle corrige au passage deux défauts préexistants découverts en cartographiant
-- le graphe des clés étrangères — l'un bloquant, l'autre exploitable.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI UNE SEULE INSTRUCTION SUFFIT ENSUITE
--
-- Supprimer la ligne `auth.users` fait tomber les 16 tables applicatives par
-- action référentielle. Ce n'est pas une supposition : les actions ON DELETE
-- sont exécutées par des triggers de contrainte internes, sous l'identité du
-- PROPRIÉTAIRE de la table et non de l'appelant. Elles ne sont donc soumises ni
-- aux privilèges de table de l'appelant, ni à la RLS.
--
-- Conséquence à assumer explicitement : le caractère « append-only » de
-- `agent_runs` et `agent_steps` — obtenu en ne leur accordant AUCUN `delete`,
-- pas même à `service_role` — ne résiste pas à la cascade. C'est ici le
-- comportement voulu : une trace d'exécution rattachée à quelqu'un qui exerce
-- son droit à l'effacement doit partir avec lui. Ne pas « réparer » cela en
-- découplant la clé étrangère.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DÉFAUT BLOQUANT — le lignage des versions pouvait traverser deux profils
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `profile_versions.created_from_version_id` référençait `profile_versions(id)`
-- sans clause `on delete`, donc en `no action`. Une version du profil A pointant
-- vers une version du profil B rendait la suppression de B IMPOSSIBLE : erreur
-- 23503, au dernier moment, sur l'écran d'une personne qui vient de confirmer.
--
-- La garantie « même profil » existait, mais seulement dans le code applicatif
-- (`publish_profile_version`). Une garantie applicative ne protège pas la base
-- des scripts d'exploitation ni des futures fonctions. On la rend déclarative.
--
-- Pré-contrôle : si des lignes fautives existent déjà, l'ADD CONSTRAINT
-- échouerait précisément dans le cas qu'il prétend corriger — et sans indiquer
-- quoi réparer. On échoue donc AVANT, avec la requête de diagnostic en clair.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.profile_versions enfant
    join public.profile_versions parent
      on parent.id = enfant.created_from_version_id
   where parent.profile_id <> enfant.profile_id;

  if v_count > 0 then
    raise exception
      'Lignage inter-profils détecté (% ligne(s)). À corriger avant migration : '
      'select enfant.id from public.profile_versions enfant '
      'join public.profile_versions parent on parent.id = enfant.created_from_version_id '
      'where parent.profile_id <> enfant.profile_id;', v_count;
  end if;
end $$;

alter table public.profile_versions
  drop constraint profile_versions_created_from_version_id_fkey;

-- La cible composite `unique (profile_id, id)` existe déjà.
-- MATCH SIMPLE : si `created_from_version_id` est NULL — la toute première
-- version d'un profil — la contrainte est satisfaite sans vérification.
alter table public.profile_versions
  add constraint profile_versions_created_from_version_id_fkey
  foreign key (profile_id, created_from_version_id)
  references public.profile_versions (profile_id, id);

comment on constraint profile_versions_created_from_version_id_fkey
  on public.profile_versions is
  'Composite à dessein : une version ne peut descendre que d''une version DU MÊME '
  'profil. Rend le lignage transportable par la cascade de profile_id, et ferme '
  'le seul point du graphe capable de faire échouer une suppression de compte.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. DÉFAUT EXPLOITABLE — six tables sans révocation des privilèges par défaut
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Supabase accorde par défaut TOUS les privilèges sur les nouvelles tables de
-- `public` à `anon`, `authenticated` et `service_role`. Le dépôt neutralise cela
-- table par table (`revoke all ... from anon, authenticated` puis des `grant`
-- précis) — motif appliqué en phases 0, 1 et 2, puis OUBLIÉ sur six tables des
-- phases 5 et 6.
--
-- État constaté avant cette migration :
--   anon           : REFERENCES, TRIGGER, TRUNCATE
--   authenticated  : ... + TRUNCATE
--   service_role   : REFERENCES, TRIGGER, TRUNCATE — et AUCUN droit DML
--
-- Deux conséquences, l'une grave, l'autre gênante :
--
--   a) TRUNCATE N'EST PAS FILTRÉ PAR LA RLS. Vérifié sur la base locale : un
--      utilisateur authentifié qui ne peut LIRE aucune ligne d'un autre (la RLS
--      fait son travail en lecture) peut malgré tout exécuter
--      `truncate public.profile_clarifications` et effacer les réponses de TOUS
--      les utilisateurs. Détruire sans jamais pouvoir consulter.
--
--   b) `service_role` ne pouvait ni lire ni écrire ces six tables. Tout chemin
--      serveur les touchant échouait en 42501.
--
-- On rétablit le motif du dépôt. Les `grant` à `authenticated` reprennent
-- EXACTEMENT les verbes que supposent les policies existantes — chacune de ces
-- six tables a quatre policies propriétaire (select / insert / update / delete),
-- ni plus ni moins.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'ai_match_insights',
    'ai_match_breakdowns',
    'ai_application_drafts',
    'ai_interview_briefs',
    'opportunity_tracking',
    'profile_clarifications'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated;', v_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', v_table);
    execute format('grant select, insert, update, delete on public.%I to service_role;', v_table);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CE QUE LA CASCADE N'ATTEINT PAS — les résidus du schéma `auth`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Trois tables du schéma `auth` n'ont AUCUNE clé étrangère vers `auth.users` et
-- survivent donc intégralement à la suppression du compte. La plus lourde,
-- `auth.audit_log_entries`, porte l'ADRESSE E-MAIL et l'ADRESSE IP.
--
-- Un trigger, et non un appel applicatif, pour quatre raisons :
--   — il s'exécute DANS la transaction de GoTrue : si la purge échoue, la
--     suppression entière est annulée, et « vos données sont intactes » reste
--     vrai (fail-closed) ;
--   — il dispose de `old.email`, introuvable après coup : aucun rattrapage ne
--     serait possible depuis l'application ;
--   — il couvre TOUS les chemins d'effacement, y compris une suppression faite
--     à la main depuis le tableau de bord Supabase ;
--   — il n'exige aucune table de reçu, qui serait elle-même un résidu.
--
-- `after delete` et non `before` : GoTrue écrit son entrée d'audit
-- « user_deleted » AVANT le DELETE, dans la même transaction. Un trigger
-- `before` manquerait précisément la ligne que l'acte de suppression vient de
-- créer.
--
-- `security invoker` et non `definer` : l'appelant EST `supabase_auth_admin`,
-- propriétaire de `auth.audit_log_entries`. Emprunter l'identité du
-- propriétaire de la fonction lui RETIRERAIT des droits.
create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Les entrées d'audit ne portent pas toutes l'identifiant : celles écrites
  -- AVANT l'existence du compte (`user_repeated_signup`) et celles écrites SUR
  -- la personne par un administrateur ne le contiennent pas. D'où les clauses
  -- sur l'adresse e-mail, seule constante entre ces cas.
  delete from auth.audit_log_entries
   where payload ->> 'actor_id'             = old.id::text
      or payload -> 'traits' ->> 'user_id'  = old.id::text
      or (old.email is not null and payload ->> 'actor_username'          = old.email)
      or (old.email is not null and payload -> 'traits' ->> 'user_email'  = old.email);

  -- `session_id` NULL : jetons émis hors session, que la cascade
  -- `auth.sessions` ne peut pas atteindre.
  delete from auth.refresh_tokens
   where user_id = old.id::text and session_id is null;

  delete from auth.flow_state where user_id = old.id;

  return old;
end;
$$;

comment on function public.handle_user_deleted() is
  'Purge les résidus du schéma auth qui n''ont aucune clé étrangère vers '
  'auth.users — audit_log_entries (adresse e-mail ET adresse IP), refresh_tokens '
  'hors session, flow_state. Volontairement sans garde `to_regclass` : entre '
  '« plus personne ne peut supprimer son compte », bruyant et réparé en une '
  'heure, et « l''IP et l''e-mail restent sans que rien ne le signale », le '
  'premier est le bon échec.';

revoke all on function public.handle_user_deleted() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_deleted();
