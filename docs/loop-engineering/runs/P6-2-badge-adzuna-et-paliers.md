# Task Loop Record — P6-2: le badge Adzuna, et un palier qui dit ce qu'il ouvre

- **schemaVersion**: 1.0
- **taskId**: P6-2
- **goal**: satisfaire les deux moitiés mesurables de la clause d'attribution Adzuna, et supprimer le dernier palier décoratif du tableau de bord.
- **status**: completed
- **attempt**: 1 / **maxAttempts**: 3
- **startedAt**: 2026-07-29T18:50:00Z / **completedAt**: 2026-07-29T18:58:00Z

## Acceptance criteria

- [x] Le crédit Adzuna occupe au moins 116×23 px, et la dimension est une donnée, pas une classe utilitaire.
- [x] Aucune autre source ne se voit imposer un badge qu'elle n'exige pas.
- [x] Le rappel de profil n'affiche plus de pourcentage, dans les **deux** locales.
- [x] Chaque capacité annoncée est adossée à une porte réelle du code.
- [x] `pnpm verify` vert.

## Constraints

- Ne pas redessiner la marque Adzuna : contrefaire un logo serait pire que le défaut traité.
- Ne rien annoncer comme capacité qui ne corresponde pas à un comportement existant.

## Actions (files created/modified)

- `src/lib/discovery/credits.ts` — `SourceCredit.badge`, posé sur Adzuna seul.
- `src/app/(dashboard)/dashboard/search-panel.tsx` — deux formes de crédit : badge dimensionné / mention en ligne.
- `src/lib/copy/index.ts` — `nudge` prend la DIMENSION et non le score, dans `fr` et `en`.
- `src/app/(dashboard)/dashboard/page.tsx` — site d'appel.
- `docs/opportunity-sources.md` — état de la clause corrigé.
- Tests : `credits.test.ts` (+2), `nudge-copy.test.ts` (nouveau, 8).

## Checks

| Check  | Command             | Result             |
| ------ | ------------------- | ------------------ |
| Format | `pnpm format:check` | passed             |
| Lint   | `pnpm lint`         | passed             |
| Types  | `pnpm typecheck`    | passed             |
| Tests  | `pnpm test`         | passed — 670 tests |
| Build  | `pnpm build`        | passed             |

## Evidence

Le tableau de bord affichait **« Profil à N % »**. La règle produit du
2026-07-26 l'interdit nommément : « jamais de pourcentage nu ; les paliers se
lisent en capacités gagnées et chacun doit être adossé à une porte réelle du
code ». Les portes retenues :

| Dimension    | Porte réelle                                                     |
| ------------ | ---------------------------------------------------------------- |
| `identity`   | `readiness.canSearch` + les intitulés de `planDeRepli`           |
| `skills`     | composante la plus lourde du score + `matchedSkills` sur l'offre |
| `scope`      | lecture de carrière → `shouldReachHigher`                        |
| `trajectory` | idem                                                             |
| `proof`      | preuves jointes aux offres                                       |

## Review findings

| Reviewer | Severity | Finding                                                                                                                                                               | Resolution                                   |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| self     | moyenne  | Un test « pas de pourcentage » se satisfait d'une phrase passe-partout servie pour toutes les dimensions — la règle serait respectée à la lettre et vide en pratique. | fixed — un test exige des phrases distinctes |

## Next action

Le palier gratuit Adzuna reste **non commercial**. Aucun code ne referme ce
point : licence à signer ou source à retirer, décision du propriétaire.

- **requiresHumanApproval**: no
- **stopReason**: acceptance criteria met
