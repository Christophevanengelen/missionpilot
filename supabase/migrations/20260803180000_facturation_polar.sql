-- Facturation Polar (Merchant of Record) — infrastructure DORMANTE.
--
-- POURQUOI MAINTENANT. Le produit n'a pas encore de paywall : ces tables
-- posent le socle Revenue avant l'ouverture, pour que l'activation ne soit
-- qu'une affaire de variables d'environnement — pas de migration de rush.
--
-- Deux tables, deux rôles :
--   billing_events  — journal brut idempotent : chaque webhook Polar y est
--                     "claimé" une seule fois (contrainte d'unicité), les
--                     retries deviennent des no-ops silencieux.
--   subscriptions   — l'état courant par utilisateur, versionné par
--                     version_timestamp : un retry livré hors ordre ne
--                     régresse jamais la ligne.

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_id text not null,
  event_type text not null,
  event_timestamp timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (source, event_id)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'none',
  status text not null default 'none',
  polar_subscription_id text,
  polar_customer_id text,
  current_period_end timestamptz,
  version_timestamp timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);

-- RLS : écriture réservée au service role (qui la contourne par nature).
-- L'utilisateur ne peut que LIRE sa propre ligne d'abonnement — c'est ce
-- qu'il faut pour afficher « Pro » dans l'interface, et rien de plus.
alter table public.billing_events enable row level security;
alter table public.subscriptions enable row level security;

create policy "abonnement visible par son proprietaire"
  on public.subscriptions for select
  using (auth.uid() = user_id);
