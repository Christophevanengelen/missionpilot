-- Consentement au traitement des données sensibles éventuellement présentes
-- dans un CV (RGPD art. 9(2)(a)).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI UNE COLONNE, ET POURQUOI UNE DATE
--
-- Un CV mentionne souvent, sans que son auteur y ait pensé, une interruption
-- de carrière pour raison de santé, un mandat syndical, un engagement
-- confessionnel ou politique, une nationalité ou une langue maternelle qui
-- révèle une origine. Ces mentions relèvent de l'article 9(1), dont le
-- traitement est interdit par principe : une base légale de l'article 6 ne
-- lève JAMAIS cette interdiction, il faut une exception de l'article 9(2).
--
-- La seule réaliste ici est le consentement explicite — 9(2)(a). Et l'art. 7(1)
-- exige de pouvoir le DÉMONTRER : un booléen ne le permet pas, une date si.
-- D'où `timestamptz`, et `null` qui veut dire « jamais donné », jamais
-- « refusé » — la distinction compte le jour où quelqu'un demande quand il a
-- consenti.
--
-- Ce que cette colonne ne fait PAS : elle n'autorise rien à elle seule. La
-- mesure technique qui compte est ailleurs, dans `src/lib/profile/cv-ai.ts` :
-- l'instruction au modèle de ne pas extraire ces catégories. Une case cochée
-- sans mesure derrière serait une décharge, pas une protection.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.candidate_profiles
  add column art9_consent_at timestamptz;

comment on column public.candidate_profiles.art9_consent_at is
  'Horodatage du consentement explicite au traitement des données sensibles '
  'éventuellement contenues dans un CV (RGPD art. 9(2)(a)). NULL = jamais '
  'donné — à ne pas lire comme un refus. Remis à NULL en cas de retrait, qui '
  'est un droit (art. 7(3)) et doit rester aussi simple à exercer qu''à donner.';

-- La personne modifie son propre consentement. Le motif du dépôt est déjà
-- posé : on n'accorde QUE la colonne concernée, jamais `update` sur la table.
grant update (art9_consent_at) on public.candidate_profiles to authenticated;
