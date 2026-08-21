-- Facturation Polar — le revoke-first oublié, et les grants qui manquaient.
--
-- La migration facturation_polar (20260803180000) a créé billing_events et
-- subscriptions SANS le `revoke all ... from anon, authenticated` appliqué
-- partout ailleurs depuis effacement_prerequis. Conséquences constatées sur
-- une base reset le 17/08 (account_deletion.test.sql, tests 1-2 rouges) :
--
--   - anon ET authenticated détenaient TRUNCATE sur les deux tables — un
--     utilisateur connecté pouvait vider le journal de facturation de tout le
--     monde, RLS ou pas ;
--   - anon détenait des privilèges sur les deux tables ;
--   - et l'inverse du même oubli : service_role n'avait AUCUN droit DML, donc
--     le webhook Polar (chemin serveur) aurait échoué en 42501 dès
--     l'activation ; l'utilisateur ne pouvait pas non plus LIRE sa ligne
--     subscriptions (la policy select existait, le GRANT non).

revoke all on public.billing_events from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;

-- L'utilisateur lit sa propre ligne d'abonnement (policy déjà en place), rien
-- de plus. billing_events reste invisible aux rôles clients.
grant select on public.subscriptions to authenticated;

grant select, insert, update, delete on public.billing_events to service_role;
grant select, insert, update, delete on public.subscriptions to service_role;
