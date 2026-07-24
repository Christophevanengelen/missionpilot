import "server-only";

import { z } from "zod";
import {
  checkDbConnectivity,
  ensureUserExists,
  finalizeRun,
  recordStep,
  startRun,
  upsertHealthResult,
  type StartRunResult,
} from "@/lib/db/agent-ops";
import { getAiProvider } from "@/lib/ai/registry";
import { env } from "@/lib/env";
import { OwnershipError, sanitizeError } from "@/lib/security/errors";
import { createLogger } from "@/lib/observability/logger";

/**
 * System-health workflow logic, decomposed into step functions so that:
 * - the Inngest handler (health.ts) wraps each stage in step.run;
 * - the integration tests exercise the exact same code deterministically,
 *   without the Inngest runtime (J4 requirement: proofs come from tests and
 *   the database, never from the Inngest UI).
 */

export const WORKFLOW_NAME = "system-health";
export const WORKFLOW_VERSION = "1.0";

export const healthEventSchema = z.strictObject({
  userId: z.uuid(),
  idempotencyKey: z.string().min(8).max(200),
  /** Test hook: exercise the controlled AI-probe failure path. */
  simulateAiFailure: z.boolean().optional(),
});
export type HealthEventPayload = z.infer<typeof healthEventSchema>;

export function correlationIdFor(idempotencyKey: string): string {
  return `health-${idempotencyKey}`;
}

export async function startHealthRun(
  payload: HealthEventPayload,
): Promise<StartRunResult> {
  if (!(await ensureUserExists(payload.userId))) {
    // The event's userId is never trusted directly (J4 requirement).
    throw new OwnershipError("Event userId does not match a provisioned user");
  }
  return startRun({
    userId: payload.userId,
    correlationId: correlationIdFor(payload.idempotencyKey),
    workflowName: WORKFLOW_NAME,
    workflowVersion: WORKFLOW_VERSION,
  });
}

export async function checkDatabaseStep(input: {
  runId: string;
  userId: string;
  attempt: number;
}): Promise<{ ok: boolean }> {
  const ok = await checkDbConnectivity();
  await recordStep({
    runId: input.runId,
    userId: input.userId,
    stepName: "check-database",
    attempt: input.attempt,
    status: ok ? "completed" : "failed",
  });
  return { ok };
}

const HEALTH_PROBE_PROMPT_VERSION = "health-probe-v1";

const healthProbeDataSchema = z.strictObject({
  status: z.literal("ok"),
  echo: z.string(),
});

export async function checkAiProviderStep(input: {
  runId: string;
  userId: string;
  attempt: number;
  simulateAiFailure?: boolean;
}): Promise<{ ok: boolean; errorCode?: string }> {
  const startedAt = performance.now();
  const log = createLogger({
    module: "health-workflow",
    runId: input.runId,
    stepName: "check-ai-provider",
    attempt: input.attempt,
  });
  try {
    // Pinned to the MOCK on purpose: the probe verifies the AI abstraction's
    // wiring (envelope validation, step recording), and must stay free and
    // deterministic even when the app's default provider is a paid one.
    const provider = getAiProvider("mock");
    const response = await provider.generateStructured({
      taskName: "system-health-probe",
      promptVersion: HEALTH_PROBE_PROMPT_VERSION,
      // Input is data only; the test hook maps to the mock's invalid-output
      // scenario to exercise the exact same failure path as before.
      input: input.simulateAiFailure
        ? { probe: "health", mockScenario: "invalid-output" }
        : { probe: "health" },
      dataSchema: healthProbeDataSchema,
    });
    await recordStep({
      runId: input.runId,
      userId: input.userId,
      stepName: "check-ai-provider",
      attempt: input.attempt,
      status: "completed",
      provider: response.provider,
      model: response.model,
      promptVersion: response.promptVersion,
      schemaValid: true,
      tokenUsage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      },
      latencyMs: response.latencyMs,
    });
    return { ok: true };
  } catch (error) {
    const sanitized = sanitizeError(error);
    log.warn("ai probe failed", { errorCode: sanitized.code });
    await recordStep({
      runId: input.runId,
      userId: input.userId,
      stepName: "check-ai-provider",
      attempt: input.attempt,
      status: "failed",
      // From configuration, not literals: the audit trail must report the
      // same provider/model on the failure path as on the success path.
      provider: env.AI_DEFAULT_PROVIDER,
      model: env.AI_DEFAULT_MODEL,
      promptVersion: HEALTH_PROBE_PROMPT_VERSION,
      schemaValid: false,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      error: `${sanitized.code}: ${sanitized.message}`,
    });
    return { ok: false, errorCode: sanitized.code };
  }
}

export type HealthOutcome = {
  deduplicated: boolean;
  runId: string;
  runStatus: string;
  healthInserted?: boolean;
  dbOk?: boolean;
  aiOk?: boolean;
};

export async function finalizeHealthStep(input: {
  runId: string;
  userId: string;
  idempotencyKey: string;
  attempt: number;
  dbOk: boolean;
  aiOk: boolean;
  aiErrorCode?: string;
}): Promise<HealthOutcome> {
  const health = await upsertHealthResult({
    userId: input.userId,
    runId: input.runId,
    idempotencyKey: input.idempotencyKey,
    dbOk: input.dbOk,
    aiMockOk: input.aiOk,
    details: { workflowVersion: WORKFLOW_VERSION },
  });
  await recordStep({
    runId: input.runId,
    userId: input.userId,
    stepName: "finalize",
    attempt: input.attempt,
    status: "completed",
  });
  const healthy = input.dbOk && input.aiOk;
  const finalized = await finalizeRun({
    runId: input.runId,
    userId: input.userId,
    status: healthy ? "completed" : "failed",
    estimatedCost: 0,
    errorCode: healthy ? null : (input.aiErrorCode ?? "HEALTH_CHECK_FAILED"),
    errorSummary: healthy
      ? null
      : "System health check failed (see step records).",
  });
  return {
    deduplicated: false,
    runId: input.runId,
    runStatus: finalized.status,
    healthInserted: health.inserted,
    dbOk: input.dbOk,
    aiOk: input.aiOk,
  };
}

/**
 * Deterministic composition of the whole sequence — the exact logic the
 * Inngest handler runs, callable directly from integration tests.
 */
export async function runHealthSequence(
  payload: HealthEventPayload,
  attempt = 1,
): Promise<HealthOutcome> {
  const parsed = healthEventSchema.parse(payload);
  const started = await startHealthRun(parsed);
  if (started.alreadyTerminal) {
    return {
      deduplicated: true,
      runId: started.runId,
      runStatus: started.status,
    };
  }
  const db = await checkDatabaseStep({
    runId: started.runId,
    userId: parsed.userId,
    attempt,
  });
  const ai = await checkAiProviderStep({
    runId: started.runId,
    userId: parsed.userId,
    attempt,
    simulateAiFailure: parsed.simulateAiFailure,
  });
  return finalizeHealthStep({
    runId: started.runId,
    userId: parsed.userId,
    idempotencyKey: parsed.idempotencyKey,
    attempt,
    dbOk: db.ok,
    aiOk: ai.ok,
    aiErrorCode: ai.errorCode,
  });
}
