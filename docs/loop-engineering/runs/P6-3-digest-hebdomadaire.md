# Task Loop Record — P6-3: le digest hebdomadaire

- **schemaVersion**: 1.0
- **taskId**: P6-3
- **goal**: livrer la dernière pièce de la vision — « le système travaille pour vous et le prouve » — sous forme d'un récapitulatif hebdomadaire par e-mail, opt-in strict, dormant tant que le propriétaire ne l'allume pas.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt**: 2026-07-29T19:00:00Z / **completedAt**: 2026-07-29T19:20:00Z

## Acceptance criteria

- [x] Opt-in strict : `opted_in` faux par défaut, aucune migration ne l'inverse.
- [x] Se désabonner ne demande PAS de se connecter, et fonctionne en un clic depuis Gmail/Apple Mail (RFC 8058).
- [x] Un digest vide ne part jamais.
- [x] Idempotence : un rejeu du balayage ne produit pas un second envoi.
- [x] Les textes de tiers sont échappés ; les URL non-http(s) écartées.
- [x] L'attribution due aux sources voyage AUSSI dans l'e-mail.
- [x] La politique de confidentialité déclare le nouveau traitement et le nouveau destinataire.
- [x] Tout part dormant : sans `DIGEST_ENABLED`, rien n'est envoyé.
- [x] `pnpm verify` vert.

## Constraints

- Aucune dépendance de production nouvelle : `fetch` nu, comme les quatre autres intégrations.
- La même recherche que l'écran (`searchMarket`), sous peine de promettre des offres que l'application ne montre pas.
- Aucun appel de modèle par abonné : le tri IA reste là où quelqu'un regarde.

## Actions (files created/modified)

- `supabase/migrations/20260729210000_digest_hebdomadaire.sql` — table + RLS + index partiel.
- `supabase/tests/digest_subscriptions_rls.test.sql` — 12 assertions pgTAP.
- `src/lib/mail/resend.ts` — envoyeur, en-têtes `List-Unsubscribe`.
- `src/lib/digest/contenu.ts` — composition pure ; `abonnement.ts` — jeton et état ; `actions.ts` — server actions.
- `src/workflows/digest-logic.ts` + `digest.ts` — balayage cron et envoi, deux fonctions séparées.
- `src/app/desabonnement/page.tsx` + `src/app/api/desabonnement/route.ts` — sortie humaine et sortie machine.
- `src/app/(dashboard)/compte/digest-panel.tsx` — le consentement.
- `src/lib/db/proxy-session.ts` — `/desabonnement` public.
- `content/legal/politique-de-confidentialite.md` — sections 3, 10, 11.3, 12.
- Tests : `digest-contenu` (13), `digest-abonnement` (10), `politique-tables` (2).

## Checks

| Check  | Command             | Result             |
| ------ | ------------------- | ------------------ |
| Format | `pnpm format:check` | passed             |
| Lint   | `pnpm lint`         | passed             |
| Types  | `pnpm typecheck`    | passed             |
| Tests  | `pnpm test`         | passed — 695 tests |
| Build  | `pnpm build`        | passed             |
| RLS    | `pnpm test:rls`     | délégué à la CI    |

## Evidence

**Deux fonctions et non une.** Un balayage qui écrirait lui-même ferait, au
réessai, renvoyer aux personnes déjà servies — et sa durée croîtrait avec le
nombre d'abonnés jusqu'à dépasser la limite un jour non choisi.

**Deux URL de désabonnement.** `List-Unsubscribe-Post` fait apparaître le bouton
natif de Gmail, celui qui est juste à côté de « Signaler comme spam ». Ces
clients envoient un **POST** ; une page Next répond aux GET. Déclarer l'en-tête
sans route POST aurait donné un 405 au destinataire, donc le bouton d'à côté.

**La politique était déjà fausse.** Elle annonçait « 16 tables » quand le schéma
en comptait 17 (`profile_search_plans`, ajoutée sans repasser par le document),
et affirmait « aucun autre service d'e-mail n'intervient » alors que le SMTP des
liens de connexion est déjà Resend. Les deux sont corrigés, et un test casse
désormais à la prochaine dérive.

## Review findings

| Reviewer | Severity | Finding                                                                                                                        | Resolution                                                            |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| self     | haute    | `List-Unsubscribe-Post` déclaré vers une page Next : POST → 405, donc bouton natif cassé.                                      | fixed — route API dédiée pour la machine, page pour l'humain          |
| self     | haute    | La politique de confidentialité ne déclarait pas Resend comme destinataire (art. 13(1)(e)).                                    | fixed — section 10, plus le décompte de tables et la section 11.3     |
| self     | moyenne  | Assertion XSS écrite comme `not.toContain(url)` : elle aurait échoué sur un échappement CORRECT, et passait pour une garantie. | fixed — l'assertion porte sur la balise `<a href=`, pas sur la chaîne |
| self     | moyenne  | Le jeton était renouvelé à chaque écriture, ce qui aurait cassé les liens des e-mails déjà partis.                             | fixed — créé une fois, jamais renouvelé                               |

## Next action

**Le digest est DORMANT.** Trois variables à poser sur Vercel puis un
redéploiement : `RESEND_API_KEY`, `DIGEST_FROM`, `DIGEST_ENABLED=true`. Tant
que l'interrupteur est éteint, le balayage s'arrête à sa première ligne.

- **requiresHumanApproval**: yes — l'allumage envoie de vrais e-mails
- **stopReason**: acceptance criteria met
