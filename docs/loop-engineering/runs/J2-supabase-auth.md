# Task Loop Record — J2: Supabase local + authentication

- **schemaVersion**: 1.0
- **taskId**: J2
- **goal**: Local Supabase stack plus full authentication — login/logout, protected accessible shell, DAL enforcement, idempotent dev-user provisioning — with no J3 business schema.
- **status**: completed
- **attempt**: 3 / **maxAttempts**: 3 (1 = implementation; 2 = auth/config repairs; 3 = review repairs)
- **startedAt** / **completedAt**: 2026-07-22T18:10:00+02:00 / 2026-07-22T18:55:00+02:00

## Acceptance criteria

- [x] Stack locale démarrée (Docker Desktop lancé, rien installé) ; clés nouveau format ; `.env.local` git-ignoré, `.env.example` sans secret
- [x] Pattern officiel Next 16 + @supabase/ssr : `src/proxy.ts` optimiste (cookies, getClaims immédiat), enforcement réel dans la DAL (`verifySession` par page), jamais `getSession()` serveur
- [x] Clé secrète confinée à `src/lib/db/admin.ts` (`server-only`, zéro importeur à ce stade) ; bundle client sans secret
- [x] Inscriptions bloquées globalement (`signUp` → « Signups not allowed for this instance ») ; provider email actif pour la connexion
- [x] Script dev-user idempotent (2 exécutions : création puis no-op code 0), API admin uniquement, refus des URL non locales
- [x] Shell accessible : skip link, landmarks, labels, `role=alert`, `h1` réels, états loading/empty/error
- [x] Tests exigés : 4/4 e2e (redirection anonyme · identifiants invalides assainis · connexion→dashboard→déconnexion→accès révoqué · /login redirige si connecté) + 4 tests unitaires DAL indépendants du proxy

## Actions (files)

Created: `supabase/config.toml` (signups off, min password 8), `src/lib/db/{config,client,server,admin,proxy-session}.ts`, `src/proxy.ts`, `src/lib/auth/{dal,actions}.ts`, `src/lib/env-guards.ts`, `src/components/theme-provider.tsx`, `src/app/(auth)/login/*`, `src/app/(dashboard)/**` (layout, dashboard, loading, error), `scripts/create-dev-user.ts`, `tests/e2e/auth.spec.ts`, `tests/unit/dal.test.ts`, `.env.local` (ignoré). Modified: `src/app/{layout,page}.tsx`, `src/lib/env.ts`, `next.config.ts`, `playwright.config.ts` ; SVG boilerplate supprimés.

## Checks (evidence)

| Check                         | Command                               | Result                                             |
| ----------------------------- | ------------------------------------- | -------------------------------------------------- |
| Gate complet (13 tests unit)  | `pnpm verify`                         | passed                                             |
| Auth e2e contre build de prod | `pnpm test:e2e`                       | passed (4/4, 9.6s)                                 |
| Idempotence dev-user          | `tsx scripts/create-dev-user.ts` ×2   | passed (« already exists — nothing to do »)        |
| Inscriptions bloquées         | signUp direct                         | passed (« Signups not allowed for this instance ») |
| Secrets bundle client         | `grep sb_secret_/valeur .next/static` | passed (absents ; publishable présente = attendu)  |

## Review findings

| Reviewer                | Severity       | Finding                                                                              | Resolution                                          |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| implementation-reviewer | major (latent) | Gardes d'env au scope module → crash navigateur dès le 1er usage client de client.ts | fixed (`env-guards.ts` appelé par next.config.ts)   |
| implementation-reviewer | minor          | Claims d'exécution non consignés                                                     | fixed (cette fiche, section Checks)                 |
| implementation-reviewer | minor          | Enforcement DAL non testé indépendamment du proxy                                    | fixed (`tests/unit/dal.test.ts`, 4 cas)             |
| security-reviewer       | minor          | `minimum_password_length = 6`                                                        | fixed (8)                                           |
| security-reviewer       | info           | `additional_redirect_urls` https/127.0.0.1 incohérente                               | fixed (http://localhost:3000)                       |
| security-reviewer       | info           | Rate-limit connexion = défauts Supabase, pas de captcha                              | accepted (local ; à durcir au déploiement, note J6) |

Défauts découverts en cours de boucle (réparation 1) : `[auth.email].enable_signup=false` désactivait aussi la CONNEXION (« Email logins are disabled ») → corrigé + commenté ; serveur `next start` résiduel faussait les e2e (build périmé) → tué ; sélecteur `getByRole("alert")` heurtait le route-announcer Next → `#login-error`.

Reports J3/J4 (security-reviewer) : gate RLS dur en J3 (tests refus + anonyme) ; en J4, tout nouveau route handler appelle `verifySession()` ou vérifie une signature (le proxy exclut `api/`) ; writes admin ⇒ contrôle de propriété explicite ; `INNGEST_SIGNING_KEY` requis en production.

## Next action

Await user approval, then J3 (schema + RLS + pgTAP).

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; all review findings fixed or accepted with rationale
