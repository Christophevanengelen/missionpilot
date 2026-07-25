import "server-only";

import type { SearchPlan } from "@/lib/discovery/plan";
import { createTtlCache } from "@/lib/discovery/cache";
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

/** Fallback: the métiers as the user confirmed them, searched by title. */
function fallbackPlans(targetRoleFamilies: readonly string[]): SearchPlan[] {
  return targetRoleFamilies
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => ({ keywords: [t], mode: "title" as const }));
}

export async function planFromProfile(
  dossier: string,
  targetRoleFamilies: readonly string[],
): Promise<ProfileSearchPlan> {
  const cached = planCache.get(dossier);
  if (cached) return cached;

  const fallback: ProfileSearchPlan = {
    plans: fallbackPlans(targetRoleFamilies),
    stepUpTitles: [],
    trajectory: null,
    searchedTitles: [...targetRoleFamilies],
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
