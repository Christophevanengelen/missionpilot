# Task Loop Record — UX Foundation (pre-Phase-1 milestone)

- **schemaVersion**: 1.0
- **taskId**: UX-foundation
- **goal**: Define a premium, calm, conversational experience — documentation, design tokens applied to the shell, and a real mock-only UX Preview — before any Phase 1 business feature. Single PR `feat/ux-foundation`; French default; Radix/shadcn only; no external service, no secret, no Phase 1 logic.
- **status**: completed
- **attempt**: 2 / **maxAttempts**: 3 (1 = build across UX0-UX3; 2 = review + contrast repairs)
- **startedAt** / **completedAt**: 2026-07-23T00:30:00+02:00 / 2026-07-23T01:45:00+02:00

## Acceptance criteria

- [x] Direction visuelle A « Studio calme » hybridée C pour les vues denses ; accent encre unique, hairline, mono numerals ; aucun cliché « IA violet »
- [x] Tokens appliqués au shell (login, dashboard, diagnostics, nav, bascule thème) en light ET dark, sans refonte fonctionnelle ; shell e2e/axe verts
- [x] 7 documents `docs/ux/` : principes, design system, framework conversationnel, parcours (10), inventaire, accessibilité, responsive — étendent UX_SPEC sans le dupliquer
- [x] Matrice d'états `proposed/confirmed/needs_review/rejected` (alignée domaine + enveloppe IA), règles de rédaction FR+EN, note i18n sans framework
- [x] **UX Preview réelle** (`/ux-preview`, mock only) démontrant : fil conversationnel · une question à la fois · carte « ce que j'ai compris » · carte de preuve · confirmer/corriger/ignorer/approfondir · les 4 états (dont `rejected` + Restaurer) · opportunité recommandée · score explicable avec preuves · validation avant action externe · responsive mobile/desktop · light/dark · clavier + reduced-motion
- [x] Critères UX opposables aux Phases 1-4 ajoutés au gabarit de PR
- [x] Aucune fonctionnalité Phase 1, aucune nouvelle dépendance UI, aucun secret, aucun service externe

## Actions (files)

Docs: `docs/ux/{UX_PRINCIPLES,DESIGN_SYSTEM,CONVERSATION_FRAMEWORK,USER_FLOWS,COMPONENT_INVENTORY,ACCESSIBILITY,RESPONSIVE_STRATEGY}.md`. Tokens: `src/app/globals.css` (palette Studio-calme light+dark, surfaces/motion/shadow). Shell: `src/components/{nav-link,theme-toggle}.tsx`, `(dashboard)/layout.tsx`, `(auth)/login/page.tsx`, `(dashboard)/diagnostics/page.tsx`. Preview: `src/app/ux-preview/*`, `src/components/{conversation,cards,context}/*`, `src/lib/ux/{card-state,conversation-types,mock-conversation}.ts`, `src/lib/copy/index.ts`, `src/components/ui/{badge,separator}.tsx` (vendorés). Contrast: `src/components/ui/button.tsx` (hover /90). Accès : `/ux-preview` protégée par la DAL (`verifySession()` dans `src/app/ux-preview/page.tsx`) ; `src/lib/db/proxy-session.ts` conserve exactement `/` et `/login` comme chemins publics (état final — un état intermédiaire public a été annulé avant le push, voir la section « Access change »). Governance : `.github/pull_request_template.md` (critères UX). Tests : `tests/e2e/ux-preview.spec.ts`.

## Checks (evidence)

| Check                                                                                             | Result             |
| ------------------------------------------------------------------------------------------------- | ------------------ |
| `pnpm verify` (format, lint, typecheck, 35 unit, build)                                           | passed             |
| `pnpm test:e2e` (10 shell + 7 ux-preview, dont axe light+dark, reduced-motion, clavier, rejected) | passed (17/17)     |
| Preuve visuelle navigateur : light + dark + responsive, toutes les cartes                         | vérifié (captures) |
| Aucune nouvelle dépendance (`git diff HEAD package.json` vide)                                    | passed             |

## Review findings

| Reviewer       | Severity | Finding                                                                                                       | Resolution                                                                                         |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| impl (UX0)     | minor ×3 | « PR template » affirmé au présent · références futures non marquées · warning contraste latent               | fixed (formulations + garde-fou DESIGN_SYSTEM)                                                     |
| impl (UX2)     | major    | « états réutilisés verbatim » faux (3/4 ne viennent pas de l'enveloppe)                                       | fixed (provenance corrigée)                                                                        |
| impl (UX2)     | minor    | flows 4 & 10 sans chemin d'erreur ; légende badge ambiguë                                                     | fixed                                                                                              |
| impl (UX3)     | major    | état `rejected` jamais démontré ; `Thread`/`ContextSummary` câblés en dur                                     | fixed (carte rejected + Restaurer ; composants passés en props + module de types)                  |
| impl (UX3)     | minor ×4 | numéro de score non visible · approbation approve trop proéminent · axe dark non testé · tokens non localisés | fixed (valeur visible ; approve/decline équivalents ; scan axe dark ; verdict/contrainte via copy) |
| security (UX3) | —        | frontière proxy + code client                                                                                 | **PASS** (une seule route publique ajoutée, aucun accès données, aucun secret, DAL inchangée)      |
| codex (UX4)    | —        | revue finale lecture seule                                                                                    | (consignée dans la PR)                                                                             |

## Anti-over-engineering

Composants prop-driven réutilisables par les vraies features (pas de jetable) ; inventaire limité à ce que les Phases 1-2 consomment (reste marqué _deferred_) ; copy centralisée sans bibliothèque i18n ; wireframes = structure, pas de pixel ; Radix non remplacé, zéro composant Tailwind Plus copié.

## Refinement pass — hiérarchie visuelle premium (2026-07-23, approved by owner)

Owner visual validation found the preview functional but flat/generic. Approved
refinement (visual only, no functional/architecture change, no new dependency)
with 4 explicit guards: hero card discreet (typography/space first, very
discreet `--shadow-raised` < `--shadow-floating`); approval card neutral-solemn
(warning styling reserved to real risk / `blocked`); rejected state recessed via
compactness + dashed border, never sub-AA contrast; sticky composer proven to
never mask the last card (dedicated e2e assertion + safe-area padding).
Delivered: card registers `quiet/document/hero/ceremonial/instrument/recessed`
in `CardShell`; label-over-value field grid (no rule lines) + chips; one filled
action max per card (approval = documented equal-outline exception);
conversation dominant (context aside demoted to hairline margin); demo state
switcher collapsed by default behind a labelled « Démo » disclosure; premium
composer (`rounded-2xl`, floating shadow, focus-within ring); `gap-8` rhythm;
vendored button transition put behind `motion-safe:`. Checks: verify green,
e2e 18/18 (axe all states light + dark, reduced motion, keyboard, composer-mask
test). Implementation-reviewer: **PASS** (2 info findings — dangling
`aria-controls` fixed; evidence accent rail confirmed rendering). Visual proof:
Playwright full-page captures light + dark + mobile.

## Refinement pass 2 — présence desktop (2026-07-23, approved by owner)

Second owner pass: product read as too small/timid on large screens. Approved
values applied: thread `max-w-3xl`, context aside `w-72` (breakpoint moved
lg→xl so the panel folds into the mobile sheet before the composition
compresses), `gap-12`; conversational text 16px, active question 18px, opening
assistant turn as lead (`text-2xl`, data-driven `lead` flag), user bubble 16px
capped ~78%; hero role 20px, score numeral 36px; composer min 56px; instrument
zones untouched; width alternation = utility cards capped `max-w-[44rem]`,
important moments full width. Mobile header decrowded (icon-only Démo/Contexte
buttons below `sm`, accessible names kept). Checks: verify green, e2e 18/18;
4 Playwright captures (desktop clair/sombre 1440, mobile clair/sombre 390).

## Access change — /ux-preview protégée (2026-07-23, owner-mandated)

Final owner validation granted; design frozen. Before push, `/ux-preview` was
put behind authentication so a future production deployment can never expose
the internal demo publicly: real enforcement via `verifySession()` (DAL) in
the route's server component + removal of `/ux-preview` from the proxy's
optimistic PUBLIC_PATHS. UX untouched. e2e updated: a dedicated test proves
anonymous visitors are redirected to /login; all other preview tests
authenticate with the local dev user (same pattern as the shell smoke tests).

## Next action

Push `feat/ux-foundation` to PR #3, await green CI, final read-only Codex
review, record all reviews honestly in the PR, STOP before merge. Phase 1
remains gated.

- **requiresHumanApproval**: yes
- **stopReason**: refinement pass implemented, gates green, impl review PASS; awaiting owner visual validation before Codex and any push/merge — Phase 1 not started
