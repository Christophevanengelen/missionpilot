import "server-only";

import { buildSearchPlans, type SearchPlan } from "@/lib/discovery/plan";
import { createTtlCache } from "@/lib/discovery/cache";

/** La forme minimale d'une affirmation de profil que le planificateur lit —
 *  la même que celle attendue par `buildSearchPlans`. */
type ProfileClaim = { kind: string; state: string; value: unknown };
import { aiMarketVocabulary } from "./ai-vocabulary";
import {
  aiReadTrajectory,
  shouldReachHigher,
  type CareerTrajectory,
} from "@/lib/career/ai-trajectory";

/**
 * What to search for, and at which altitudes.
 *
 * This is where the product's promise becomes queries. Three questions, in
 * order, and each one can fail without breaking the next:
 *
 * 1. Where is this career today, and is the next step already earned?
 * 2. How does the market word THIS level?
 * 3. If the step is earned — how does it word the level ABOVE?
 *
 * Every AI step degrades to nothing: with no provider, or on any failure, the
 * planner falls back to the profile's own métiers, which is exactly how the
 * engine searched before any of this existed. The product never breaks because
 * the intelligence was unavailable — it only becomes less clever.
 */

export type ProfileSearchPlan = {
  plans: SearchPlan[];
  /** Titles that mark an offer as the step up, for the staircase split. */
  stepUpTitles: string[];
  /** Null when AI is unavailable or the career could not be read. */
  trajectory: CareerTrajectory | null;
  /** The market phrasings we searched, shown to the user so the widening is
   *  auditable rather than magic. */
  searchedTitles: string[];
};

/**
 * One dossier is read at most once an hour.
 *
 * The planner costs up to three model calls, and it runs on EVERY visit because
 * the results must be fresh. The dossier, however, changes when the user edits
 * their profile — not between two page loads — so caching on its exact text is
 * both safe and the difference between a viable product and a wasteful one.
 */
const planCache = createTtlCache<ProfileSearchPlan>(60 * 60 * 1000);

/**
 * Le repli, et il partage désormais celui de la recherche manuelle.
 *
 * Il ne regardait AUTREFOIS que les métiers cibles. Conséquence : quelqu'un qui
 * terminait l'onboarding en répondant « Service Designer » à la question du
 * métier — donc avec un rôle confirmé — n'obtenait AUCUN résultat, parce que
 * les métiers cibles, eux, étaient vides. La recherche manuelle, au même
 * instant, savait très bien quoi chercher : elle se rabat sur le rôle confirmé
 * puis sur les compétences.
 *
 * L'ouverture était donc strictement plus faible que le champ de recherche
 * qu'elle est censée rendre inutile. C'est la boucle centrale du produit qui
 * cassait — on donne tout de suite, sans demander de chercher — et elle
 * cassait précisément pour un nouvel utilisateur.
 */
function fallbackPlans(
  targetRoleFamilies: readonly string[],
  claims: readonly ProfileClaim[],
): SearchPlan[] {
  return buildSearchPlans(claims, targetRoleFamilies);
}

/**
 * Combien de recherches un plan a le DROIT de déclencher dans un rendu.
 *
 * Le 2026-07-29 à 17h37, le premier plan précalculé a été écrit et le tableau
 * de bord a cessé d'afficher quoi que ce soit. Mesuré dans les journaux de
 * production, et non déduit : sur le rendu de 17h55, France Travail — qui est
 * une entrée de source et UNE SEULE — a enregistré douze recherches. Le plan en
 * porte donc douze, ce qui est exactement ce que le calcul autorise :
 * `MAX_TERMS` vaut 6 dans `ai-vocabulary`, et le vocabulaire est demandé deux
 * fois, au niveau actuel puis au palier du dessus.
 *
 * Douze intitulés ne coûtent pas douze recherches : chacun est rejoué sur
 * CHAQUE entrée de source, et Adzuna comme Himalayas comptent une entrée par
 * pays. À un pays cela fait 12 × 8 = 96 recherches dans un seul rendu, à trois
 * pays 12 × 12 = 144 — par lots de six, donc seize à vingt-quatre lots
 * enchaînés. Le repli déterministe, lui, en produit au plus trois
 * (`MAX_TARGET_SEARCHES`) : le plan a quadruplé le travail d'un rendu sans que
 * personne n'ait décidé que le rendu pouvait se le permettre.
 *
 * Quatre plutôt que trois : trois est PROUVÉ tenable — le même jour à 16h39, le
 * repli affichait 688 offres — et la quatrième place est réservée à la marche
 * du dessus, qui est la raison d'être de l'escalier.
 *
 * La borne s'applique à la LECTURE, jamais au calcul : ce que le modèle a
 * trouvé reste rangé en entier, et c'est l'écran qui décide de ce qu'il peut
 * s'offrir. Un plan déjà écrit cesse donc de casser la page sans attendre un
 * recalcul — ce qui compte, puisqu'il y en avait un en production.
 */
export const MAX_SEARCH_PLANS = 4;

/** Places réservées au palier supérieur sur les `MAX_SEARCH_PLANS`. Une marche
 *  cherchée vaut mieux que six annoncées et aucune atteinte. */
const MAX_STEP_UP_PLANS = 1;

/** Forme de comparaison d'un intitulé : « Head of Design » et « head of
 *  design » désignent la même recherche. */
function cle(mot: string): string {
  return mot.trim().toLowerCase();
}

/**
 * Le plan ramené à ce qu'un rendu peut porter.
 *
 * Ce qui est écarté l'est VRAIMENT : `searchedTitles` et `stepUpTitles` sont
 * recalculés sur les seuls plans gardés. L'écran qui explique pourquoi la liste
 * est ce qu'elle est ne doit annoncer aucun mot qu'on n'a pas envoyé.
 *
 * Tolérant à une ligne mal formée : ce plan vient d'une colonne JSON, et une
 * borne de sécurité qui plante sur ce qu'elle est censée protéger ne protège
 * rien.
 */
export function bornerPlan(plan: ProfileSearchPlan): ProfileSearchPlan {
  const plans = Array.isArray(plan?.plans) ? plan.plans : [];
  if (plans.length <= MAX_SEARCH_PLANS) return plan;

  const titresMarche = new Set(
    (Array.isArray(plan.stepUpTitles) ? plan.stepUpTitles : []).map(cle),
  );
  const estMarche = (p: SearchPlan): boolean =>
    Array.isArray(p.keywords) &&
    p.keywords.some((k) => titresMarche.has(cle(k)));

  const marches = plans.filter(estMarche);
  const niveau = plans.filter((p) => !estMarche(p));
  const reservees = Math.min(MAX_STEP_UP_PLANS, marches.length);

  const gardees = [
    ...niveau.slice(0, MAX_SEARCH_PLANS - reservees),
    ...marches.slice(0, reservees),
  ];
  // Un dossier peut n'avoir presque aucun intitulé à son niveau : la place
  // laissée libre revient alors aux marches plutôt que d'être perdue.
  for (const marche of marches.slice(reservees)) {
    if (gardees.length >= MAX_SEARCH_PLANS) break;
    gardees.push(marche);
  }

  const cherches = new Set(
    gardees
      .flatMap((p) => (Array.isArray(p.keywords) ? p.keywords : []))
      .map(cle),
  );
  return {
    ...plan,
    plans: gardees,
    stepUpTitles: (Array.isArray(plan.stepUpTitles)
      ? plan.stepUpTitles
      : []
    ).filter((t) => cherches.has(cle(t))),
    searchedTitles: motsCherches(gardees),
  };
}

/** Les mots réellement envoyés aux plateformes, pour pouvoir les MONTRER. */
function motsCherches(plans: readonly SearchPlan[]): string[] {
  const vus = new Set<string>();
  const mots: string[] = [];
  for (const plan of plans) {
    for (const mot of plan.keywords) {
      const cle = mot.trim().toLowerCase();
      if (!cle || vus.has(cle)) continue;
      vus.add(cle);
      mots.push(mot.trim());
    }
  }
  return mots;
}

/**
 * Le repli SEUL — déterministe, sans un seul appel de modèle.
 *
 * C'est ce que l'écran affiche pendant qu'un plan n'a pas encore été calculé en
 * fond. Il n'est pas dégradé au point d'être inutile : il cherche sur les
 * métiers cibles, et à défaut sur le rôle confirmé puis les compétences, ce qui
 * est exactement ce que faisait le moteur avant que l'IA n'existe.
 */
export function planDeRepli(
  targetRoleFamilies: readonly string[],
  claims: readonly ProfileClaim[] = [],
): ProfileSearchPlan {
  const plans = fallbackPlans(targetRoleFamilies, claims);
  return {
    plans,
    stepUpTitles: [],
    trajectory: null,
    // Les mots RÉELLEMENT envoyés, et non les métiers cibles : le repli peut
    // chercher sur le rôle confirmé ou sur des compétences, et annoncer autre
    // chose que ce qu'on a fait serait un mensonge sur l'écran même qui doit
    // expliquer pourquoi la liste est ce qu'elle est.
    searchedTitles: motsCherches(plans),
  };
}

/**
 * Le calcul complet, appels de modèle compris — SANS cache.
 *
 * Il ne doit plus jamais être appelé depuis un rendu de page : mesuré entre 10
 * et 22 secondes en production le 2026-07-29, il faisait passer le tableau de
 * bord pour cassé. Sa place est dans le travail de fond
 * (`workflows/plan-logic.ts`), qui range le résultat pour la visite suivante.
 */
export async function calculerPlan(
  dossier: string,
  targetRoleFamilies: readonly string[],
  claims: readonly ProfileClaim[] = [],
): Promise<ProfileSearchPlan> {
  const fallback = planDeRepli(targetRoleFamilies, claims);
  if (dossier.trim() === "") return fallback;

  const [trajectory, vocabulary] = await Promise.all([
    aiReadTrajectory(dossier),
    aiMarketVocabulary(dossier),
  ]);

  const levelTitles = vocabulary?.titles ?? [];
  // The step up is asked for ONLY when the career analysis found evidence it is
  // earned. An unanswered question is not a green light: filling someone's
  // results with roles they cannot yet defend is the same disservice as hiding
  // roles they could.
  const stepUp = shouldReachHigher(trajectory)
    ? await aiMarketVocabulary(dossier, trajectory.nextLevel)
    : null;
  const stepUpTitles = stepUp?.titles ?? [];

  const all = [...levelTitles, ...stepUpTitles];
  if (all.length === 0) return fallback;

  return {
    // Each phrasing is its own title-targeted search: a market that says
    // "Design Director" and a market that says "Head of Design" are two
    // different queries, and ORing them would return the noise of both.
    plans: all.map((t) => ({ keywords: [t], mode: "title" as const })),
    stepUpTitles,
    trajectory,
    searchedTitles: all,
  };
}

/**
 * @deprecated Le chemin de rendu lit désormais le plan précalculé
 * (`plan-store.ts`) et se rabat sur `planDeRepli`. Conservé pour les appels
 * hors rendu qui veulent le cache mémoire d'une heure.
 */
export async function planFromProfile(
  dossier: string,
  targetRoleFamilies: readonly string[],
  claims: readonly ProfileClaim[] = [],
): Promise<ProfileSearchPlan> {
  const cached = planCache.get(dossier);
  if (cached) return cached;

  const plansDeRepli = fallbackPlans(targetRoleFamilies, claims);
  const fallback: ProfileSearchPlan = {
    plans: plansDeRepli,
    stepUpTitles: [],
    trajectory: null,
    // Les mots RÉELLEMENT envoyés, et non les métiers cibles : le repli peut
    // chercher sur le rôle confirmé ou sur des compétences, et annoncer autre
    // chose que ce qu'on a fait serait un mensonge sur l'écran même qui doit
    // expliquer pourquoi la liste est ce qu'elle est.
    searchedTitles: motsCherches(plansDeRepli),
  };
  if (dossier.trim() === "") return fallback;

  const [trajectory, vocabulary] = await Promise.all([
    aiReadTrajectory(dossier),
    aiMarketVocabulary(dossier),
  ]);

  const levelTitles = vocabulary?.titles ?? [];
  // The step up is asked for ONLY when the career analysis found evidence it is
  // earned. An unanswered question is not a green light: filling someone's
  // results with roles they cannot yet defend is the same disservice as hiding
  // roles they could.
  const stepUp = shouldReachHigher(trajectory)
    ? await aiMarketVocabulary(dossier, trajectory.nextLevel)
    : null;
  const stepUpTitles = stepUp?.titles ?? [];

  const all = [...levelTitles, ...stepUpTitles];
  if (all.length === 0) return fallback;

  const result: ProfileSearchPlan = {
    // Each phrasing is its own title-targeted search: a market that says
    // "Design Director" and a market that says "Head of Design" are two
    // different queries, and ORing them would return the noise of both.
    plans: all.map((t) => ({ keywords: [t], mode: "title" as const })),
    stepUpTitles,
    trajectory,
    searchedTitles: all,
  };
  planCache.set(dossier, result);
  return result;
}
