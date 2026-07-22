# Task Loop Record — J6: Quality, e2e smoke, CI, docs (+ Codex review integration)

- **schemaVersion**: 1.0
- **taskId**: J6
- **goal**: Committed least-privilege CI mirroring the local gates, full smoke journey with axe scan, scripted keyboard pass, operational README for a non-developer, documented deviations — after integrating the external Codex review findings in their mandated order.
- **status**: completed
- **attempt**: 3 / **maxAttempts**: 3 (1 = Codex sequence + implementation; 2 = keyboard/focus repairs; 3 = reviewer repairs)
- **startedAt** / **completedAt**: 2026-07-22T21:25:00+02:00 / 2026-07-22T22:20:00+02:00

## Codex review (external, accepted by the product owner)

Verdict — reproduced verbatim in the closure documentation (README status banner):
**solid foundation, but the business product is not yet functional; Phase 0 is
NOT an end-user MVP.** Mandated sequence executed before the rest of J6:

1. Prettier formatting fully green (`pnpm format:check`) ✓
2. `next/font/google` replaced by system font stacks — no downloaded fonts, no
   build-time network fetch; build succeeds offline post-install ✓
3. Supabase local verified healthy (pg_isready) ✓
4. All gates re-run green: test:rls 28/28 · test:integration 7/7 ·
   test:e2e 10/10 · verify 35/35 ✓
   Extra criterion proven: the shell renders with ZERO external requests
   (smoke-test network assertion over the whole journey).

## Acceptance criteria (user-mandated, all verified)

- [x] CI préparée, aucun dépôt distant/service/secret créé ; `permissions: contents: read`, zéro `secrets.*`, sûre pour PR non fiables
- [x] Versions d'actions vérifiées via l'API GitHub le 22/07/2026 (majors flottants documentés ; SHA-pinning requis avant tout secret)
- [x] `pnpm install --frozen-lockfile` dans les deux jobs
- [x] CI = gates locaux sans logique divergente (job quality exécute littéralement `pnpm verify` ; job stack = test:rls/integration/e2e ; union = verify:full)
- [x] Stack Supabase jetable dans le runner, teardown `if: always()` ; jamais de base hébergée ; mot de passe CI généré par run
- [x] Aucun secret réel/mot de passe/identifiant personnel dans .env.example, README, workflows, fixtures, artefacts (balayages exécutés)
- [x] README opérable par un non-développeur assisté : prérequis, commandes exactes, démarrage, arrêt propre, reprise après erreur, validations humaines ; local / préparation / déploiement réel distingués
- [x] Déviations documentées : Radix, mock uniquement, aucun adaptateur OpenAI/Anthropic, logger JSON sans OTel, polices système
- [x] Smoke : redirection anonyme → connexion → dashboard → diagnostics → déconnexion + axe 0 violation serious/critical (3 pages) + zéro requête externe
- [x] Passe clavier (scriptée, 4 tests) : skip link, ordre de tabulation, focus visible (`:focus-visible` + styles calculés), connexion clavier seul, navigation principale, déclenchement du diagnostic, **restitution du focus après erreur**
- [x] Axe jamais présenté comme preuve WCAG complète (README §8 : passe manuelle humaine + lecteur d'écran requis avant toute publication)
- [x] `passWithNoTests` définitivement absent ; fiches loop-engineering auditées (une page, pas de raisonnement interne, pas de secret/PII)
- [x] Phase 1 non commencée ; J7 non commencé (pas de git)

## Actions (files)

Created: `.github/workflows/ci.yml`, `tests/e2e/smoke.spec.ts`, `tests/e2e/keyboard.spec.ts`. Modified: `README.md` (réécriture opérationnelle + verdict Codex + déviations), `.env.example` (+DEV_USER_*), `src/app/layout.tsx` + `globals.css` (polices système), `login-form.tsx` + `trigger-form.tsx` (restitution du focus), `playwright.config.ts` (reporter html), `.gitignore` (+supabase/.branches/).

## Checks (evidence)

| Check                                         | Result                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| Séquence Codex (ordre imposé 1→4)             | passed                                               |
| `pnpm verify:full` complet                    | passed (35 unit · 28 pgTAP · 7 integration · 10 e2e) |
| Scan axe (login, dashboard, diagnostics)      | 0 violation serious/critical                         |
| Requêtes externes pendant le parcours         | 0 (assertion réseau)                                 |
| Dérivation env CI (`supabase status -o env`)  | les 3 clés résolvent non vides (F2 retiré)           |
| Rapport HTML Playwright produit et gitignored | passed                                               |
| Balayages secrets/PII/passWithNoTests/fiches  | clean                                                |

## Défaut réel découvert par la passe clavier

Le bouton passait `disabled` pendant l'action → perte du focus vers `<body>`
après une erreur (login ET diagnostics). Corrigé par restitution conditionnelle
du focus (`document.activeElement === body` uniquement — jamais de vol de
focus), validé par le test « focus restitution after an error ».

## Review findings

| Reviewer                | Severity | Finding                                                                           | Resolution                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| implementation-reviewer | minor    | Artefact d'échec CI vide (aucun reporter html configuré)                          | fixed (reporter html + vérifié produit)                                    |
| implementation-reviewer | minor    | Dérivation env CI jamais exécutée (noms de clés CLI incertains)                   | fixed (vérifiée localement : API_URL/PUBLISHABLE_KEY/SECRET_KEY non vides) |
| implementation-reviewer | info     | Commentaire « versions vérifiées » vs majors flottants                            | fixed (commentaire honnête + condition de passage au SHA-pinning)          |
| security-reviewer       | minor    | `supabase/.branches/` non ignoré avant git init                                   | fixed (.gitignore)                                                         |
| security-reviewer       | info     | Tags majeurs détournables (risque résiduel faible : zéro secret, token read-only) | accepted (SHA-pinning obligatoire avant le premier secret du repo)         |
| security-reviewer       | info     | Traces Playwright d'échec peuvent contenir le mot de passe synthétique par-run    | accepted (valeur jetable, stack détruite, artefact gated par l'accès repo) |

## Risks carried to J7 / later phases

- **J7 secret-scan checklist** (security-reviewer) : grep `sb_secret_[A-Za-z0-9_-]+`, `SUPABASE_SECRET_KEY=` non vide, JWT legacy `eyJ…`, `DEV_USER_PASSWORD=` non vide hors .env.example, clés INNGEST/OPENAI/ANTHROPIC/CRON, blocs PRIVATE KEY, email réel du propriétaire ; premier `git status` : .env.local, supabase/.temp, supabase/.branches, test-results, playwright-report, .next non suivis.
- CI jamais exécutée de bout en bout (impossible sans dépôt distant — par conception Phase 0) ; première exécution réelle au push GitHub.
- SHA-pinning des actions avant l'introduction du moindre secret de repo.
- Passe clavier humaine + lecteur d'écran avant toute publication.
- Run orphelin `running` (sweeper) et test moteur Inngest complet — reportés des jalons précédents.

## Next action

Await user approval for J7 (closure). Phase 1 remains BLOCKED until J7 is closed and approved.

- **requiresHumanApproval**: yes
- **stopReason**: acceptance criteria met and verified; Codex sequence completed and documented; reviewer findings fixed or accepted with rationale
