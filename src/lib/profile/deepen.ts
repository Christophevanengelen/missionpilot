import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { buildProfileDossier } from "@/lib/matching/insight-logic";
import { aiReadTrajectory } from "@/lib/career/ai-trajectory";
import { createLogger } from "@/lib/observability/logger";
import {
  loadAnswers,
  loadPendingCareer,
  recordCareerQuestions,
} from "./clarifications";
import { loadLivingProfile, loadPreferences } from "./logic";

/**
 * Going deeper, once the obvious questions are exhausted.
 *
 * The deterministic questions ask what any form would ask — métier, niveau,
 * mobilité. They open the search, and they are cheap and explainable. But they
 * cannot open the STAIRCASE: judging whether someone has already earned the
 * rung above needs scope — how many people, what budget, which decisions were
 * theirs — and a CV that lists titles without scope simply does not say.
 *
 * That is exactly the case the career reading answers `unknown` for, returning
 * the questions that would settle it. Until now those questions were produced
 * and then dropped on the floor: nothing stored them, nothing asked them,
 * nothing fed an answer back. This is the missing half.
 *
 * DELIBERATELY LAZY. It runs only when the deterministic questions have run
 * out, so nobody is interrogated about budgets before the product has shown
 * them a single result. And it costs one model call, at most once, because a
 * profile with pending career questions is left alone until they are settled.
 */

type Client = SupabaseClient<Database>;

const log = createLogger({ module: "profile-deepen" });

/**
 * Ask the career reading what it still needs, and record those questions.
 *
 * Returns silently on every failure path — no provider, an unreadable dossier,
 * a model that declined to answer. Deepening is a bonus on top of a product
 * that already works; it must never be able to break the screen that asked
 * for it.
 */
export async function deepenIfExhausted(
  client: Client,
  profileId: string,
): Promise<void> {
  try {
    // Already owed answers? Then the conversation is mid-flight and piling on
    // more questions would be the wall this design exists to avoid.
    const pending = await loadPendingCareer(client, profileId);
    if (pending.length > 0) return;

    const [living, preferences, answers] = await Promise.all([
      loadLivingProfile(client, profileId),
      loadPreferences(client, profileId),
      loadAnswers(client, profileId),
    ]);

    const dossier = buildProfileDossier(
      living.claims,
      { targetRoleFamilies: preferences.targetRoleFamilies },
      answers,
    );
    if (dossier.trim() === "") return;

    const trajectory = await aiReadTrajectory(dossier);
    // Only `unknown` earns questions. A reading that reached a verdict has no
    // business taking more of someone's time to re-confirm it.
    if (trajectory === null || trajectory.readiness !== "unknown") return;
    if (trajectory.questions.length === 0) return;

    await recordCareerQuestions(client, profileId, trajectory.questions);
  } catch (error) {
    log.error("deepen failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}
