-- Apply Pack L5 — le registre des envois.
--
-- POURQUOI CETTE TABLE EXISTE. Le 2026-09-01, une lettre d'acceptation partie à
-- 15:27 a été renvoyée à 19:58 au même recruteur, en pleine négociation de TJM.
-- L'état d'envoi avait été DÉDUIT de la présence d'un brouillon résiduel au lieu
-- d'être LU quelque part. Le même mois, un mail d'approche a échoué à la remise
-- pendant quatre jours sans que rien ne le signale.
--
-- `opportunity_tracking` ne pouvait pas empêcher ça, et ce n'est pas un défaut :
-- elle stocke un ÉTAT courant (`stage`), réécrit à chaque changement. Un état ne
-- répond ni à « quand », ni à « par quel canal », ni à « est-ce arrivé », ni à
-- « combien de fois ». Il fallait des ÉVÉNEMENTS.
--
-- Le produit n'envoie toujours rien. `prepare, don't send` tient : cette table
-- enregistre ce que la personne a envoyé elle-même, elle ne déclenche aucun
-- envoi et n'ouvre aucune boîte mail.

create table public.application_dispatches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  opportunity_id uuid not null,

  -- Le canal est une liste fermée pour que « qu'est-ce qui marche » se réponde
  -- par un `group by` et pas par de la lecture de prose. Le relevé du 01/09
  -- disait : approche directe 1 réponse sur 7 remis, portails 0 sur 17.
  channel text not null
    check (channel in ('direct', 'portal', 'agency', 'referral', 'inbound')),

  -- À qui, dans les mots de la personne : une adresse, un nom de cabinet, un
  -- formulaire. Nullable parce qu'un dépôt sur portail n'a parfois pas de
  -- destinataire nommé.
  recipient text check (recipient is null
                        or char_length(recipient) between 1 and 320),

  sent_at timestamptz not null default now(),

  -- Le jour de l'envoi, en UTC, dérivé et immuable. C'est la clé du garde-fou
  -- anti-doublon ci-dessous : stocké et généré, il ne dérive pas avec le fuseau
  -- de la session et ne peut pas être contredit par une écriture applicative.
  sent_on date not null generated always as ((sent_at at time zone 'UTC')::date) stored,

  -- La remise est un fait de première classe, pas une déduction. `unknown` par
  -- défaut : le produit ne peut pas observer la boîte mail de la personne, et
  -- prétendre le contraire serait pire que se taire.
  delivery text not null default 'unknown'
    check (delivery in ('unknown', 'delivered', 'bounced', 'failed')),
  delivery_checked_at timestamptz,

  replied_at timestamptz,
  reply_kind text
    check (reply_kind is null
           or reply_kind in ('interview', 'rejection', 'question', 'other')),

  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),

  -- LA CONTRAINTE QUI REFUSE L'INCIDENT. Deux envois le même jour, sur la même
  -- opportunité, par le même canal : c'est le doublon du 01/09 et rien d'autre.
  -- La clé inclut le jour ET le canal, donc une relance une semaine plus tard
  -- reste possible, et deux cabinets sur le même mandat aussi — le 01/09 chez
  -- Proximus, T-Crew et Hays chassaient le même siège, le modèle doit le
  -- permettre. On refuse la répétition, pas le suivi.
  unique (profile_id, opportunity_id, channel, sent_on),

  -- Une réponse sans envoi n'existe pas, et une remise vérifiée non plus.
  constraint application_dispatches_reply_kind_needs_reply
    check (reply_kind is null or replied_at is not null),
  constraint application_dispatches_reply_after_send
    check (replied_at is null or replied_at >= sent_at),

  foreign key (profile_id, opportunity_id)
    references public.opportunities (profile_id, id) on delete cascade
);

-- Le CV réellement joint. FK composite : impossible d'attacher la variante d'un
-- autre profil. Suppression de la variante = on efface la référence, jamais
-- l'événement d'envoi, qui reste vrai.
alter table public.application_dispatches
  add column cv_variant_id uuid,
  add constraint application_dispatches_variant_same_profile
    foreign key (profile_id, cv_variant_id)
    references public.cv_variants (profile_id, id)
    on delete set null (cv_variant_id);

-- Adosse l'action référentielle, comme pour les brouillons.
create index application_dispatches_cv_variant_idx
  on public.application_dispatches (profile_id, cv_variant_id)
  where cv_variant_id is not null;

-- L'ordre de lecture du registre : le dernier envoi d'abord.
create index application_dispatches_recent_idx
  on public.application_dispatches (profile_id, sent_at desc);

-- Les envois dont la remise n'est pas établie : c'est cette requête qui aurait
-- rendu Orbis visible au lieu de le laisser mourir quatre jours en silence.
create index application_dispatches_undelivered_idx
  on public.application_dispatches (profile_id, sent_at)
  where delivery = 'unknown';

alter table public.application_dispatches enable row level security;

create policy "dispatches owner select" on public.application_dispatches
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "dispatches owner insert" on public.application_dispatches
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "dispatches owner update" on public.application_dispatches
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "dispatches owner delete" on public.application_dispatches
  for delete to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- LE `revoke all` D'ABORD (leçon d'effacement_prerequis, rejouée par
-- offres_ecartees et facturation_polar) : sans lui, anon et authenticated
-- héritent notamment de TRUNCATE, que la RLS ne filtre pas.
revoke all on public.application_dispatches from anon, authenticated;
grant select, insert, update, delete on public.application_dispatches to authenticated;
grant select, insert, update, delete on public.application_dispatches to service_role;
