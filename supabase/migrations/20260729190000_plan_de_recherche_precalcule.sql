-- Le plan de recherche, calculé À L'AVANCE plutôt qu'à chaque affichage.
--
-- CE QUE ÇA CORRIGE, mesuré en production le 2026-07-29. Le tableau de bord
-- mettait 25 secondes à s'afficher, au point de passer pour cassé. La cause
-- n'était pas la découverte — les quatre plateformes répondaient en 1,3 à 3,2
-- secondes à elles toutes — mais TROIS appels de modèle enchaînés avant même
-- que la recherche ne commence : 10,1 s sur un affichage, 22,6 s sur le
-- suivant, dont un seul appel à 16,3 s.
--
-- Ces trois appels lisent le DOSSIER de la personne : sa trajectoire de
-- carrière, puis les mots que le marché emploie pour son niveau, puis ceux du
-- niveau au-dessus. Aucun ne dépend de l'instant : ils dépendent du profil, qui
-- change quand on l'édite, pas entre deux rafraîchissements de page.
--
-- Un cache existait déjà — une heure, EN MÉMOIRE. Son commentaire annonçait
-- « un dossier n'est lu qu'une fois par heure ». Sur des fonctions serverless,
-- chaque instance froide repart vide, donc en pratique c'était à chaque visite.
-- C'est le piège que cette table ferme : un cache qui survit au processus.
--
-- UNE SEULE LIGNE PAR PROFIL. Ce n'est pas un historique, c'est un résultat
-- courant : la clé primaire est le profil lui-même, et le calcul suivant écrase
-- le précédent.

create table public.profile_search_plans (
  profile_id uuid primary key
    references public.candidate_profiles (id) on delete cascade,

  -- L'empreinte SHA-256 du dossier à partir duquel le plan a été calculé.
  --
  -- C'est ELLE qui décide si le plan est encore valable, et pas une durée. Une
  -- date d'expiration se trompe dans les deux sens : elle jette un plan encore
  -- juste, et elle garde un plan devenu faux dès que la personne corrige son
  -- profil. L'empreinte, elle, ne se trompe jamais — un dossier différent donne
  -- une empreinte différente, un dossier identique donne la même.
  dossier_hash text not null check (char_length(dossier_hash) = 64),

  -- Les versions de prompt ayant produit ce plan, concaténées.
  --
  -- Sans ce champ, améliorer un prompt laisserait tous les profils existants
  -- sur l'ancien résultat, indéfiniment et sans trace : le dossier n'a pas
  -- changé, donc l'empreinte non plus. Le plan serait périmé et personne ne
  -- pourrait le savoir en regardant la ligne.
  prompt_versions text not null check (char_length(prompt_versions) between 1 and 200),

  -- Le `ProfileSearchPlan` sérialisé : requêtes, intitulés cherchés, intitulés
  -- de la marche supérieure, lecture de trajectoire.
  plan jsonb not null,

  computed_at timestamptz not null default now()
);

alter table public.profile_search_plans enable row level security;

-- REVOKE AVANT TOUT GRANT, et `all`, pas une liste.
--
-- Supabase accorde des privilèges par défaut à `anon` et `authenticated` sur
-- toute table neuve de `public`. Énumérer ce qu'on retire — truncate, delete,
-- insert, update — laisse passer ce qu'on a oublié : ici SELECT pour `anon`.
-- C'est mot pour mot la mécanique de la faille du 2026-07-27, où six tables
-- avaient gardé TRUNCATE parce que personne n'avait écrit `revoke all`. La
-- suite pgTAP l'a rattrapé sur cette table avant qu'elle n'existe en
-- production ; la formulation ci-dessous est celle qui ne peut pas se tromper
-- par omission.
revoke all on public.profile_search_plans from anon, authenticated;

-- Le travail de fond écrit avec la clé secrète : il lui faut le DML, et rien
-- de moins qu'explicitement.
grant select, insert, update, delete on public.profile_search_plans
  to service_role;

-- LECTURE SEULE pour la personne, et AUCUNE policy d'écriture.
--
-- Le plan est produit par un travail de fond qui n'a pas de session
-- utilisateur ; il écrit avec la clé secrète, hors RLS (déviation D7 déjà
-- déclarée pour les tables opérationnelles). Ouvrir l'écriture à
-- `authenticated` permettrait à quelqu'un de se fabriquer un plan à la main :
-- ce sont les mots envoyés aux plateformes, donc ce serait un canal
-- d'injection dans nos propres requêtes sortantes.
create policy "search plan owner select" on public.profile_search_plans
  for select to authenticated
  using (profile_id in (
    select id from public.candidate_profiles where user_id = (select auth.uid())
  ));

-- Le seul privilège rendu, et il correspond exactement à la seule policy :
-- les privilèges de table et la RLS doivent raconter la même histoire.
grant select on public.profile_search_plans to authenticated;
