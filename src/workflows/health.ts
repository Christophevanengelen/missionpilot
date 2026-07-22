import { NonRetriableError } from "inngest";
import { inngest } from "@/workflows/client";
import { env } from "@/lib/env";
import {
  checkAiProviderStep,
  checkDatabaseStep,
  finalizeHealthStep,
  healthEventSchema,
  startHealthRun,
} from "@/workflows/health-logic";

/**
 * Durable system-health workflow (Inngest SDK v4).
 * Idempotency layers: (1) producer event id, (2) the `idempotency` CEL key
 * below (24h window), (3) database UNIQUE constraints on correlation_id and
 * idempotency_key — the only layer that holds forever and is proven by the
 * deterministic integration tests.
 */
export const systemHealthFunction = inngest.createFunction(
  {
    id: "system-health",
    retries: 2,
    idempotency: "event.data.idempotencyKey",
    // Bounds the privileged write path against event floods
    // (security-reviewer J4): a leaked event key cannot fan out unbounded.
    concurrency: { limit: 2 },
    throttle: { limit: 10, period: "1m" },
    triggers: [{ event: "system/health.requested" }],
  },
  async ({ event, step, attempt }) => {
    const parsed = healthEventSchema.safeParse(event.data);
    if (!parsed.success) {
      // Malformed payloads are permanent failures — never retried.
      throw new NonRetriableError("Invalid system/health.requested payload");
    }
    if (env.APP_ENV === "production" && parsed.data.simulateAiFailure) {
      // Test hook only: never honored in production.
      throw new NonRetriableError(
        "simulateAiFailure is not allowed in production",
      );
    }
    const payload = parsed.data;
    const attemptNumber = (attempt ?? 0) + 1;

    const started = await step.run("start-run", () => startHealthRun(payload));
    if (started.alreadyTerminal) {
      return {
        deduplicated: true,
        runId: started.runId,
        runStatus: started.status,
      };
    }

    const db = await step.run("check-database", () =>
      checkDatabaseStep({
        runId: started.runId,
        userId: payload.userId,
        attempt: attemptNumber,
      }),
    );

    const ai = await step.run("check-ai-provider", () =>
      checkAiProviderStep({
        runId: started.runId,
        userId: payload.userId,
        attempt: attemptNumber,
        simulateAiFailure: payload.simulateAiFailure,
      }),
    );

    return await step.run("finalize", () =>
      finalizeHealthStep({
        runId: started.runId,
        userId: payload.userId,
        idempotencyKey: payload.idempotencyKey,
        attempt: attemptNumber,
        dbOk: db.ok,
        aiOk: ai.ok,
        aiErrorCode: ai.errorCode,
      }),
    );
  },
);
