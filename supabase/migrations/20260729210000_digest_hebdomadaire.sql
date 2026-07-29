-- L'abonnement au digest hebdomadaire.
--
-- CE QUE ÇA COMPLÈTE. La vision du produit tient en une phrase : « le système
-- travaille pour vous et le prouve ». Jusqu'ici il ne travaillait que pendant
-- qu'on le regardait — fermez l'onglet, il ne se passe plus rien. Le digest est
-- la moitié manquante : une fois par semaine, il va voir ce que le marché a
-- bougé et il n'écrit QUE s'il a trouvé quelque chose.
--
-- POURQUOI UNE TABLE ET PAS UNE COLONNE de plus sur le profil. Trois raisons,
-- et chacune suffirait :
--
-- 1. Le jeton de désabonnement doit être lisible SANS session. Le mettre sur le
--    profil obligerait à ouvrir en lecture une table qui porte le CV de
--    quelqu'un, pour servir un lien de désinscription.
-- 2. L'abonnement a son propre cycle de vie : on s'abonne, on se désabonne, on
--    se réabonne, et la date du dernier envoi n'a rien à faire dans un profil.
-- 3. Un consentement se retire. Une table dédiée rend le retrait lisible d'un
--    coup d'œil, ce qui est exactement ce qu'on veut pouvoir montrer.
--
-- OPT-IN, JAMAIS L'INVERSE. `opted_in` vaut `false` par défaut et aucune
-- migration ne le passe à `true` : personne ne reçoit d'e-mail parce qu'on a
-- décidé pour lui. C'est la position RGPD, et c'est aussi la seule qui soit
-- cohérente avec un produit dont l'argument est qu'il ne fait rien en votre nom.

create table public.digest_subscriptions (
  profile_id uuid primary key
    references public.candidate_profiles (id) on delete cascade,

  -- Le consentement lui-même. Faux tant que la personne n'a pas cliqué.
  opted_in boolean not null default false,

  -- Le jeton du lien « se désabonner », porté dans chaque e-mail.
  --
  -- IL DOIT ÊTRE IMPRÉVISIBLE, et c'est sa seule exigence de sécurité : il
  -- désabonne sans demander à s'authentifier. Un identifiant séquentiel ou un
  -- UUID dérivé du profil permettrait de désabonner quelqu'un d'autre en
  -- devinant. 32 octets tirés au hasard, produits côté application, où le
  -- générateur est explicite et testable plutôt que dépendant d'une extension.
  --
  -- Ce qu'il ne fait PAS : il n'authentifie personne et n'ouvre aucune donnée.
  -- Le pire qu'un jeton volé permette, c'est de désabonner sa victime — une
  -- nuisance, jamais une fuite. C'est délibérément le seul pouvoir qu'on lui
  -- donne.
  unsubscribe_token text not null unique
    check (char_length(unsubscribe_token) = 64),

  -- Le dernier envoi RÉUSSI. C'est lui qui rend la tâche planifiée
  -- idempotente : un rejeu le même jour ne renvoie rien.
  last_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Le balayage hebdomadaire lit « qui est abonné, et qui n'a rien reçu
-- récemment ». Sans cet index il parcourt toute la table à chaque exécution.
create index digest_subscriptions_a_envoyer
  on public.digest_subscriptions (last_sent_at)
  where opted_in;

alter table public.digest_subscriptions enable row level security;

-- REVOKE AVANT TOUT GRANT, et `all`, pas une liste.
--
-- Supabase accorde des privilèges par défaut à `anon` et `authenticated` sur
-- toute table neuve de `public`. Énumérer ce qu'on retire laisse passer ce
-- qu'on a oublié — c'est mot pour mot la mécanique de la faille du 2026-07-27,
-- où six tables avaient gardé TRUNCATE parce que personne n'avait écrit
-- `revoke all`.
revoke all on public.digest_subscriptions from anon, authenticated;

-- La tâche planifiée écrit avec la clé secrète : elle n'a pas de session.
grant select, insert, update, delete on public.digest_subscriptions
  to service_role;

-- La personne voit et pilote SON abonnement, et rien d'autre.
create policy "digest owner select" on public.digest_subscriptions
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

create policy "digest owner insert" on public.digest_subscriptions
  for insert to authenticated
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- `using` ET `with check` : sans le second, on pourrait modifier sa propre
-- ligne pour la faire pointer vers le profil d'un autre.
create policy "digest owner update" on public.digest_subscriptions
  for update to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ))
  with check (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- AUCUNE policy de suppression, et c'est voulu : se désabonner est une mise à
-- jour, pas un effacement. Supprimer la ligne ferait perdre la trace du
-- consentement retiré — or c'est précisément ce qu'on doit pouvoir montrer.
-- L'effacement du compte emporte la ligne par cascade, ce qui est le seul cas
-- où elle doit disparaître.

-- Les privilèges de table et la RLS racontent la même histoire : ni plus, ni
-- moins que ce que les trois policies autorisent.
grant select, insert, update on public.digest_subscriptions to authenticated;
