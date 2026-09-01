-- Apply Pack L5 — le registre des envois.
--
-- POURQUOI CETTE TABLE EXISTE. Le 2026-09-01, une lettre d'acceptation partie à
-- 15:27 a été renvoyée à 19:58 au même recruteur, en pleine négociation de TJM.
-- L'état d'envoi avait été DÉDUIT de la présence d'un brouillon résiduel au lieu
-- d'être LU quelque part. En août, un mail d'approche a échoué à la remise
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

  -- La forme comparable du destinataire, dérivée et immuable. `nullif(…, '')`
  -- rabat un destinataire fait d'espaces sur NULL : sinon il échapperait à la
  -- clé d'unicité tout en ne nommant personne.
  recipient_key text
    generated always as (nullif(lower(btrim(recipient)), '')) stored,

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

  -- LA CONTRAINTE QUI REFUSE L'INCIDENT : même destinataire, même offre, même
  -- canal, même jour. C'est le doublon du 01/09 (deux fois la même lettre à
  -- Imane chez T-Crew) et rien d'autre.
  --
  -- `recipient` est dans la clé, et il a fallu une mesure pour s'en apercevoir.
  -- Sans lui, la contrainte refusait aussi T-Crew ET Hays le même jour sur le
  -- siège Proximus : deux cabinets, deux envois réels, un seul (profil, offre,
  -- 'agency', jour). Un registre qui refuse d'enregistrer un envoi qui a eu
  -- lieu renvoie la personne à la supposition — l'incident du 01/09 par l'autre
  -- bout.
  --
  -- `nulls not distinct` (PG15+) est load-bearing : `recipient_key` est nullable
  -- pour les dépôts sur portail, et la règle SQL par défaut rend deux NULL
  -- DISTINCTS, ce qui rouvrirait le trou pour exactement les envois qui n'ont
  -- pas de destinataire nommé. Deux dépôts le même jour sur la même offre sans
  -- destinataire distinct se ressemblent trop pour être comptés deux fois : si
  -- la personne les distingue, elle nomme le destinataire.
  --
  -- C'est `recipient_key` et non `recipient` : sur du texte libre saisi à la
  -- main, « T-Crew », « t-crew » et « T-Crew » avec une espace finale sont le
  -- même cabinet, et une clé sensible à la casse laisserait passer le doublon
  -- qu'elle est censée attraper. Le champ affiché garde la graphie de la
  -- personne ; seule la clé est normalisée.
  --
  -- CE QUE CETTE CLÉ REFUSE VOLONTAIREMENT : un renvoi corrigé le même jour au
  -- même destinataire (CV rectifié, coquille). C'est le même geste que
  -- l'incident du 01/09 vu de l'extérieur, et aucune contrainte ne peut les
  -- distinguer. Le bon geste produit n'est pas une seconde ligne mais la mise à
  -- jour de la première — un envoi corrigé reste un envoi.
  unique nulls not distinct
    (profile_id, opportunity_id, channel, sent_on, recipient_key),

  -- Une réponse sans envoi n'existe pas, et une remise vérifiée non plus.
  constraint application_dispatches_reply_kind_needs_reply
    check (reply_kind is null or replied_at is not null),
  constraint application_dispatches_reply_after_send
    check (replied_at is null or replied_at >= sent_at),
  -- La seconde moitié de la phrase ci-dessus était annoncée et non tenue :
  -- rien n'empêchait de vérifier une remise avant l'envoi.
  constraint application_dispatches_check_after_send
    check (delivery_checked_at is null or delivery_checked_at >= sent_at),

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
-- `service_role` EST RÉVOQUÉ EXPLICITEMENT, et c'est le point à ne pas rater :
-- ne pas lui accorder de grant ne suffit pas. Sur un projet Supabase qui a
-- gardé ses `ALTER DEFAULT PRIVILEGES` d'origine, le rôle reçoit ses droits
-- AUTOMATIQUEMENT à la création de la table. Omettre le `grant` laisse donc un
-- accès complet en place, sur un rôle `BYPASSRLS`, tout en donnant l'impression
-- contraire. La première version de ce fichier omettait le grant ET affirmait
-- en commentaire que le rôle n'avait pas accès : l'affirmation était fausse sur
-- la base hébergée, vraie seulement sur la pile locale.
--
-- Pourquoi le révoquer plutôt que suivre le motif maison : aucun chemin serveur
-- ne touche cette table (la lecture du compte passe par le client de SESSION,
-- `src/lib/account/logic.ts`), et elle contient les adresses des recruteurs
-- approchés, donc de la donnée personnelle de TIERS. Un DML complet accordé à
-- un rôle qui contourne la RLS, pour un besoin qui n'existe pas, c'est offrir
-- le carnet d'adresses de tout le monde à une fuite de `SUPABASE_SECRET_KEY`.
-- L'effacement du compte n'en dépend pas : il passe par `auth.admin.deleteUser`
-- et la cascade s'exécute sous l'identité du propriétaire, hors grants.
revoke all on public.application_dispatches from anon, authenticated, service_role;
grant select, insert, update, delete on public.application_dispatches to authenticated;
