"use server";

/**
 * Where an answer finally lands.
 *
 * The product already asked questions — the career reading produced them and
 * the interface displayed them — but there was no field to answer in and no
 * action to receive one. It asked and looked away. This closes that loop, and
 * it is the difference between a conversation and an interrogation.
 *
 * Two guarantees hold it together:
 *
 * 1. **The question is settled before anything else happens.** Whether the
 *    answer was usable or not, whether the person said "I don't know" or gave
 *    a fact, we record that this question has been PUT and dealt with. A loop
 *    that can re-ask indefinitely is a trap, and the failure mode of a trap is
 *    that people leave.
 * 2. **An unreadable answer is refused, not interpreted.** Storing a best
 *    guess would silently distort every search that follows, and the person
 *    would have no way to trace the bad results back to the moment we decided
 *    we knew what they meant.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import * as profile from "./logic";
import { settleClarification } from "./clarifications";
import { deepenIfExhausted } from "./deepen";
import { applyAnswer } from "./answer-apply";
import type { QuestionTarget } from "./next-question";

const logger = createLogger({ module: "profile-question-actions" });

const targetSchema = z.union([
  z.object({
    kind: z.literal("claim"),
    claim: z.enum(["role", "seniority", "years_experience"]),
  }),
  z.object({
    kind: z.literal("preference"),
    field: z.enum([
      "targetRoleFamilies",
      "allowedWorkRegions",
      "remotePolicy",
      "preferredEngagementTypes",
    ]),
  }),
  z.object({ kind: z.literal("dossier") }),
]);

const answerSchema = z.object({
  questionKey: z.string().trim().min(1).max(200),
  /** Where the question came from. Hard-coding "gap" here would file a career
   *  question under the wrong origin, and the deepening pass — which looks for
   *  PENDING career rows — would keep re-asking it forever. */
  origin: z.enum(["gap", "career"]).default("gap"),
  question: z.string().trim().min(1).max(300),
  target: targetSchema,
  /** null means "I don't know" — a real, recorded outcome. */
  answer: z.string().trim().max(2000).nullable(),
});

export type AnswerResult =
  { ok: true } | { ok: false; error: "unreadable" | "empty" | "failed" };

export async function answerQuestionAction(
  input: unknown,
): Promise<AnswerResult> {
  try {
    const parsed = answerSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const own = await profile.getOwnProfile(client);

    // "I don't know" — settle it and stop asking. Nothing is written to the
    // profile, because not knowing is not a fact about a career.
    if (parsed.answer === null || parsed.answer === "") {
      await settleClarification(client, own.id, {
        questionKey: parsed.questionKey,
        question: parsed.question,
        origin: parsed.origin,
        answer: null,
      });
      revalidatePath("/dashboard");
      // "layout" scope: /profile has nested routes, and the default scope
      // would leave their cache intact (see revalidateProfile in actions.ts).
      revalidatePath("/profile", "layout");
      return { ok: true };
    }

    const applied = applyAnswer(parsed.target as QuestionTarget, parsed.answer);
    if (!applied.ok) {
      // Deliberately NOT settled: the question was not actually answered, so
      // the person gets to try again rather than losing the chance silently.
      return { ok: false, error: applied.reason };
    }

    if (applied.applied.to === "dossier") {
      // Nothing else to write: the clarification row IS the record, and the
      // dossier reads it from there on the next search.
    } else if (applied.applied.to === "claim") {
      const claimId = await profile.submitClaim(
        client,
        own.id,
        applied.applied.kind,
        applied.applied.value,
        { origin: "user" },
      );
      // Confirmed on the spot: the person stated it about themselves. There is
      // nothing left to review, and leaving it "proposed" would mean their own
      // answer did not count towards being searched for.
      await profile.setClaimState(client, claimId, "confirmed");
    } else {
      const current = await profile.loadPreferences(client, own.id);
      await profile.savePreferences(client, own.id, {
        ...current,
        ...applied.applied.patch,
      });
    }

    await settleClarification(client, own.id, {
      questionKey: parsed.questionKey,
      question: parsed.question,
      origin: parsed.origin,
      answer: parsed.answer,
    });

    // Once the obvious questions run out, ask the career reading what it still
    // needs. Deliberately after the answer is stored, and deliberately silent
    // on failure: deepening is a bonus on top of a product that already works.
    await deepenIfExhausted(client, own.id);

    revalidatePath("/dashboard");
    revalidatePath("/profile", "layout");
    return { ok: true };
  } catch (error) {
    logger.error("answer question failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "failed" };
  }
}
