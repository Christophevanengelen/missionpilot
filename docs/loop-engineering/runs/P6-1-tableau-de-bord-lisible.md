# Task Loop Record — P6-1: le tableau de bord affiche à nouveau quelque chose

- **schemaVersion**: 1.0
- **taskId**: P6-1
- **goal**: réparer la panne du 2026-07-29 (aucun contenu rendu sur `/dashboard`) et rétablir la barre de progression par source, revertée par précaution sur un signal ambigu.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt**: 2026-07-29T18:11:00Z / **completedAt**: 2026-07-29T18:45:00Z

## Acceptance criteria

- [x] Le fan-out d'un rendu est borné et la borne est vérifiée par un test.
- [x] Une source sans filtre de mots-clés n'est interrogée qu'une fois, sur les **deux** chemins de recherche.
- [x] Aucun appel de modèle du chemin de rendu ne peut dépasser la durée de vie de la fonction.
- [x] La barre de progression par source est rétablie sans rouvrir la panne.
- [x] `pnpm verify` vert.

## Constraints

- Ne pas attendre un recalcul de fond pour désamorcer la ligne déjà écrite en base.
- Ne rien annoncer à l'écran qui n'ait pas été réellement cherché.

## Diagnostic (mesuré, non déduit)

Journaux de production du déploiement `405621f`, rendu du 2026-07-29 17h55 :

1. **Le plan précalculé porte 12 intitulés.** France Travail est **une** entrée
   de source et une seule ; il a enregistré **12 recherches** sur ce seul rendu.
   Origine : `MAX_TERMS = 6` dans `ai-vocabulary`, demandé deux fois (niveau
   courant + palier au-dessus).
2. **Le multiplicateur n'est pas « 7 plateformes ».** Adzuna et Himalayas
   comptent une entrée **par pays** : 8 entrées à un pays → **96 recherches**,
   12 entrées à trois pays → **144**. Par lots de 6, 16 à 24 lots enchaînés. Le
   repli déterministe en produit au plus 3 (`MAX_TARGET_SEARCHES`).
3. **Remote OK et Recruitee ignorent les mots-clés** : chaque intitulé rejouait
   le même téléchargement. Les journaux montrent 6 appels Remote OK et les mêmes
   locataires Recruitee reparsés 6 fois sur un rendu.
4. **`aiTriageOffers` héritait du plafond fournisseur de 30 s**, plus long que la
   vie de la fonction : un tri lent n'y dégradait pas l'écran, il l'empêchait
   d'exister. Aucune erreur applicative, car un dépassement de durée ne passe
   pas par le logger.

## Actions (files created/modified)

- `src/lib/search/plan-from-profile.ts` — `MAX_SEARCH_PLANS = 4`, `bornerPlan()`.
- `src/lib/search/plan-store.ts` — borne appliquée **à la lecture**.
- `src/lib/discovery/plan.ts` — `ignoresKeywords` sur `DiscoverySource`, `plansPourSource()` exporté.
- `src/lib/discovery/par-source.ts` — même règle sur le second chemin, dénominateur réel.
- `src/lib/discovery/sources.ts` — Remote OK et Recruitee marqués.
- `src/lib/ai/types.ts`, `src/lib/ai/openai-provider.ts` — `timeoutMs` par appel, borné par le plafond.
- `src/lib/search/ai-triage.ts` — `TRIAGE_TIMEOUT_MS = 8_000`.
- `src/app/(dashboard)/dashboard/page.tsx` — `maxDuration = 60` (filet, pas permis).
- `src/app/(dashboard)/dashboard/progression-sources.tsx` — regroupement par plateforme.
- Tests : `plan-precalcule`, `discovery-concurrent`, `discovery-par-source`.

## Checks

| Check       | Command                 | Result                               |
| ----------- | ----------------------- | ------------------------------------ |
| Format      | `pnpm format:check`     | passed                               |
| Lint        | `pnpm lint`             | passed                               |
| Types       | `pnpm typecheck`        | passed                               |
| Tests       | `pnpm test`             | passed — 660 tests                   |
| Build       | `pnpm build`            | passed                               |
| Intégration | `pnpm test:integration` | skipped — Supabase local non démarré |

## Evidence

- Fan-out ramené de 96–144 à **26–42** recherches par rendu.
- Le regroupement par plateforme corrige aussi des **clés React dupliquées** :
  `lancements` porte plusieurs entrées du même nom (une par pays).

## Review findings

| Reviewer | Severity | Finding                                                                                                                                                   | Resolution                                                               |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| self     | haute    | Le premier correctif ne couvrait que `runMultiSourceDiscovery` ; `lancerParSource`, le chemin réellement emprunté par cet écran, rejouait tous les plans. | fixed — règle factorisée dans `plansPourSource()`, importée par les deux |
| self     | moyenne  | `ProgressionSources` utilisait le nom de source en clé React, alors que les noms se répètent par pays.                                                    | fixed — regroupement par plateforme                                      |

## Next action

Deux sources restent mortes côté exploitation et **aucun code ne les répare** :
Adzuna en 429 de quota, France Travail en `invalid_client`. La barre de
progression les rend désormais lisibles au lieu de les laisser ressembler à une
page vide.

- **requiresHumanApproval**: no
- **stopReason**: acceptance criteria met
