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
