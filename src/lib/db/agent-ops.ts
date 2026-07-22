import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/db/admin";
import {
  assertRunTransition,
  assertStepTransition,
  isTerminalRunStatus,
  type RunStatus,
  type StepStatus,
} from "@/domain/run-state";
import { OwnershipError } from "@/lib/security/errors";
import { createLogger } from "@/lib/observability/logger";

/**
 * The ONLY privileged write path for operational tables. Rules enforced here
 * (SECURITY_AND_COMPLIANCE.md, ARCHITECTURE.md §9, J4 requirements):
 * - the generic admin client is never handed out — workflows call these
 *   narrow, purpose-built operations only;
 * - every input is Zod-validated; the event's userId is never trusted
 *   directly: it must resolve to an existing provisioned user;
 * - every write verifies ownership of the touched rows explicitly, because
 *   RLS is bypassed on this path;
 * - run/step status changes go through the explicit state machine.
 */

const db = () => createServiceClient();

const uuidSchema = z.uuid();

const log = createLogger({ module: "agent-ops" });

/** The event's userId is not trusted: it must map to a provisioned user. */
export async function ensureUserExists(userId: string): Promise<boolean> {
  const parsed = uuidSchema.safeParse(userId);
  if (!parsed.success) {
    return false;
  }
  const { data, error } = await db()
    .from("candidate_profiles")
    .select("user_id")
    .eq("user_id", parsed.data)
    .maybeSingle();
  if (error) {
    throw new Error(`user lookup failed: ${error.code}`);
  }
  return data !== null;
}

const startRunSchema = z.strictObject({
  userId: uuidSchema,
  correlationId: z.string().min(1).max(200),
  workflowName: z.string().min(1),
  workflowVersion: z.string().min(1),
});

export type StartRunResult = {
  runId: string;
  status: RunStatus;
  alreadyTerminal: boolean;
};

/**
 * Idempotent run start keyed on correlation_id: inserts the run, or returns
 * the existing one. Never resets a terminal run to running (state machine).
 */
export async function startRun(
  input: z.infer<typeof startRunSchema>,
): Promise<StartRunResult> {
  const p = startRunSchema.parse(input);

  // Self-verifying: the caller-provided userId must resolve to a provisioned
  // user before ANY row is written (defense in depth — callers check too).
  // Note: this proves the user exists, not that they originated the event;
  // today the only producer is the DAL-verified server action. Any future
  // producer must carry the userId inside its authenticated/signed envelope.
  if (!(await ensureUserExists(p.userId))) {
    throw new OwnershipError("Event userId does not match a provisioned user");
  }

  const inserted = await db()
    .from("agent_runs")
    .insert({
      user_id: p.userId,
      workflow_name: p.workflowName,
      workflow_version: p.workflowVersion,
      correlation_id: p.correlationId,
      status: "running",
    })
    .select("id, status")
    .maybeSingle();

  if (!inserted.error && inserted.data) {
    log.info("run started", {
      correlationId: p.correlationId,
      runId: inserted.data.id,
    });
    return {
      runId: inserted.data.id,
      status: inserted.data.status as RunStatus,
      alreadyTerminal: false,
    };
  }

  // 23505 = unique violation on correlation_id: the run already exists.
  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(`run insert failed: ${inserted.error.code}`);
  }

  const existing = await db()
    .from("agent_runs")
    .select("id, status, user_id")
    .eq("correlation_id", p.correlationId)
    .single();
  if (existing.error) {
    throw new Error(`run lookup failed: ${existing.error.code}`);
  }
  // Ownership check: a correlation id can never be replayed by another user.
  if (existing.data.user_id !== p.userId) {
    throw new OwnershipError();
  }
  const status = existing.data.status as RunStatus;
  log.info("run already exists", {
    correlationId: p.correlationId,
    runId: existing.data.id,
    status,
  });
  return {
    runId: existing.data.id,
    status,
    alreadyTerminal: isTerminalRunStatus(status),
  };
}

/** Loads a run and verifies it belongs to userId (throws OwnershipError). */
async function requireOwnedRun(runId: string, userId: string) {
  const { data, error } = await db()
    .from("agent_runs")
    .select("id, user_id, status, correlation_id")
    .eq("id", uuidSchema.parse(runId))
    .single();
  if (error) {
    throw new Error(`run lookup failed: ${error.code}`);
  }
  if (data.user_id !== uuidSchema.parse(userId)) {
    throw new OwnershipError();
  }
  return data;
}

const recordStepSchema = z.strictObject({
  runId: uuidSchema,
  userId: uuidSchema,
  stepName: z.string().min(1),
  attempt: z.number().int().min(1),
  status: z.enum(["running", "completed", "failed", "skipped"]),
  provider: z.string().nullish(),
  model: z.string().nullish(),
  promptVersion: z.string().nullish(),
  inputHash: z.string().nullish(),
  outputHash: z.string().nullish(),
  schemaValid: z.boolean().nullish(),
  tokenUsage: z.record(z.string(), z.number()).nullish(),
  latencyMs: z.number().int().min(0).nullish(),
  error: z.string().nullish(),
});

/**
 * Upserts a step on (run_id, step_name, attempt): a replay of the same
 * attempt updates the same logical row — completed steps are never
 * duplicated. Ownership of the parent run is verified first.
 */
export async function recordStep(
  input: z.infer<typeof recordStepSchema>,
): Promise<{ stepStatus: StepStatus }> {
  const p = recordStepSchema.parse(input);
  await requireOwnedRun(p.runId, p.userId);

  // Step state machine: writing the same status again is an idempotent
  // replay; any other change from a terminal status is an illegal transition.
  const existing = await db()
    .from("agent_steps")
    .select("status")
    .eq("run_id", p.runId)
    .eq("step_name", p.stepName)
    .eq("attempt", p.attempt)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`step lookup failed: ${existing.error.code}`);
  }
  if (existing.data && existing.data.status !== p.status) {
    assertStepTransition(existing.data.status as StepStatus, p.status);
  }

  const { error } = await db()
    .from("agent_steps")
    .upsert(
      {
        run_id: p.runId,
        step_name: p.stepName,
        attempt: p.attempt,
        status: p.status,
        provider: p.provider ?? null,
        model: p.model ?? null,
        prompt_version: p.promptVersion ?? null,
        input_hash: p.inputHash ?? null,
        output_hash: p.outputHash ?? null,
        schema_valid: p.schemaValid ?? null,
        token_usage: p.tokenUsage ?? null,
        latency_ms: p.latencyMs ?? null,
        error: p.error ?? null,
      },
      { onConflict: "run_id,step_name,attempt" },
    );
  if (error) {
    throw new Error(`step upsert failed: ${error.code}`);
  }
  log.info("step recorded", {
    runId: p.runId,
    stepName: p.stepName,
    attempt: p.attempt,
    status: p.status,
  });
  return { stepStatus: p.status };
}

const finalizeRunSchema = z.strictObject({
  runId: uuidSchema,
  userId: uuidSchema,
  status: z.enum(["completed", "failed", "cancelled"]),
  estimatedCost: z.number().min(0).default(0),
  errorCode: z.string().nullish(),
  errorSummary: z.string().nullish(),
});

/** Terminal transition, validated by the state machine. Idempotent: */
/** finalizing an already-terminal run with the same status is a no-op. */
export async function finalizeRun(
  input: z.infer<typeof finalizeRunSchema>,
): Promise<{ status: RunStatus }> {
  const p = finalizeRunSchema.parse(input);
  const run = await requireOwnedRun(p.runId, p.userId);
  const current = run.status as RunStatus;

  if (current === p.status) {
    return { status: current }; // idempotent replay
  }
  assertRunTransition(current, p.status);

  const { data: updated, error } = await db()
    .from("agent_runs")
    .update({
      status: p.status,
      finished_at: new Date().toISOString(),
      estimated_cost: p.estimatedCost,
      error_code: p.errorCode ?? null,
      error_summary: p.errorSummary ?? null,
    })
    .eq("id", p.runId)
    .eq("user_id", p.userId)
    .eq("status", current)
    .select("id");
  if (error) {
    throw new Error(`run finalize failed: ${error.code}`);
  }
  if ((updated ?? []).length === 0) {
    // Lost a concurrent compare-and-swap race: another finalizer won.
    // Report the ACTUAL terminal status instead of pretending ours applied.
    const settled = await requireOwnedRun(p.runId, p.userId);
    log.warn("run finalize lost CAS race", {
      runId: p.runId,
      correlationId: run.correlation_id,
      requestedStatus: p.status,
      actualStatus: settled.status,
    });
    return { status: settled.status as RunStatus };
  }
  log.info("run finalized", {
    runId: p.runId,
    correlationId: run.correlation_id,
    status: p.status,
  });
  return { status: p.status };
}

const healthResultSchema = z.strictObject({
  userId: uuidSchema,
  runId: uuidSchema,
  idempotencyKey: z.string().min(1).max(200),
  dbOk: z.boolean(),
  aiMockOk: z.boolean(),
  details: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .nullish(),
});

/**
 * The single logical business effect of the health workflow. INSERT with
 * ON CONFLICT DO NOTHING on idempotency_key: concurrent or replayed
 * executions can never produce a second row.
 */
export async function upsertHealthResult(
  input: z.infer<typeof healthResultSchema>,
): Promise<{ inserted: boolean }> {
  const p = healthResultSchema.parse(input);
  await requireOwnedRun(p.runId, p.userId);

  const { data, error } = await db()
    .from("system_health_results")
    .upsert(
      {
        user_id: p.userId,
        run_id: p.runId,
        idempotency_key: p.idempotencyKey,
        db_ok: p.dbOk,
        ai_mock_ok: p.aiMockOk,
        details: p.details ?? null,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    throw new Error(`health result upsert failed: ${error.code}`);
  }
  const inserted = (data ?? []).length > 0;
  if (!inserted) {
    // Row already exists: verify it belongs to the same user (ownership).
    const existing = await db()
      .from("system_health_results")
      .select("user_id")
      .eq("idempotency_key", p.idempotencyKey)
      .single();
    if (existing.error) {
      throw new Error(`health result lookup failed: ${existing.error.code}`);
    }
    if (existing.data.user_id !== p.userId) {
      throw new OwnershipError();
    }
  }
  log.info("health result recorded", {
    runId: p.runId,
    inserted,
  });
  return { inserted };
}

/** Cheap connectivity probe through the privileged connection. */
export async function checkDbConnectivity(): Promise<boolean> {
  const { error } = await db()
    .from("candidate_profiles")
    .select("user_id", { head: true, count: "exact" });
  return !error;
}
