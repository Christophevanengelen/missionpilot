import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { correlationIdFor, runHealthSequence } from "@/workflows/health-logic";

// Deterministic idempotency/failure proofs for the system-health workflow,
// executed against the LOCAL Supabase stack — the exact logic the Inngest
// handler wraps in step.run, without the Inngest runtime (the Inngest UI is
// never treated as evidence). Requires `supabase start` + the dev user
// (scripts/create-dev-user.ts).
//
// The admin client below is used for test PROVISIONING and ASSERTIONS only
// (reading actual DB state) — RLS behaviour itself is proven by pgTAP.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let devUserId: string;
let intruderUserId: string;
const intruderEmail = `intruder-${randomUUID()}@test.local`;

beforeAll(async () => {
  const { data, error } = await admin
    .from("candidate_profiles")
    .select("user_id")
    .limit(10);
  if (error) throw new Error(`fixture lookup failed: ${error.message}`);
  const dev = data?.[0];
  if (!dev) {
    throw new Error(
      "dev user missing — run: pnpm exec tsx scripts/create-dev-user.ts",
    );
  }
  devUserId = dev.user_id;

  // Second synthetic user for cross-user replay checks (supported admin API).
  const created = await admin.auth.admin.createUser({
    email: intruderEmail,
    password: `synthetic-${randomUUID()}`,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`intruder fixture failed: ${created.error?.message}`);
  }
  intruderUserId = created.data.user.id;
});

afterAll(async () => {
  if (intruderUserId) {
    await admin.auth.admin.deleteUser(intruderUserId); // synthetic test user
  }
});

async function dbState(idempotencyKey: string) {
  const correlationId = correlationIdFor(idempotencyKey);
  const [runs, health] = await Promise.all([
    admin
      .from("agent_runs")
      .select("id, status, error_code, error_summary, finished_at")
      .eq("correlation_id", correlationId),
    admin
      .from("system_health_results")
      .select("id, user_id, db_ok, ai_mock_ok")
      .eq("idempotency_key", idempotencyKey),
  ]);
  const steps =
    runs.data && runs.data.length === 1
      ? await admin
          .from("agent_steps")
          .select("step_name, attempt, status, schema_valid, error")
          .eq("run_id", runs.data[0].id)
          .order("step_name")
      : { data: [] };
  return {
    runs: runs.data ?? [],
    health: health.data ?? [],
    steps: steps.data ?? [],
  };
}

describe("system-health workflow — deterministic proofs", () => {
  it("two SEQUENTIAL triggers with the same key: one row, one run, one logical effect", async () => {
    const key = `seq-${randomUUID()}`;

    const first = await runHealthSequence({
      userId: devUserId,
      idempotencyKey: key,
    });
    expect(first.deduplicated).toBe(false);
    expect(first.runStatus).toBe("completed");
    expect(first.healthInserted).toBe(true);

    const second = await runHealthSequence({
      userId: devUserId,
      idempotencyKey: key,
    });
    expect(second.deduplicated).toBe(true);
    expect(second.runId).toBe(first.runId);

    const state = await dbState(key);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe("completed");
    expect(state.health).toHaveLength(1);
    expect(state.steps).toHaveLength(3); // check-ai-provider, check-database, finalize
  });

  it("two CONCURRENT triggers with the same key: still one row and no duplicated steps", async () => {
    const key = `conc-${randomUUID()}`;

    const [a, b] = await Promise.all([
      runHealthSequence({ userId: devUserId, idempotencyKey: key }),
      runHealthSequence({ userId: devUserId, idempotencyKey: key }),
    ]);
    expect(a.runId).toBe(b.runId);

    const state = await dbState(key);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe("completed");
    expect(state.health).toHaveLength(1);
    expect(state.steps).toHaveLength(3);
  });

  it("replay after completion does not duplicate steps nor reset the terminal status", async () => {
    const key = `replay-${randomUUID()}`;
    await runHealthSequence({ userId: devUserId, idempotencyKey: key });
    const before = await dbState(key);

    const replay = await runHealthSequence({
      userId: devUserId,
      idempotencyKey: key,
    });
    expect(replay.deduplicated).toBe(true);

    const after = await dbState(key);
    expect(after.steps).toEqual(before.steps);
    expect(after.runs[0].status).toBe("completed");
    expect(after.runs[0].finished_at).toBe(before.runs[0].finished_at);
  });

  it("controlled mock-provider failure: coherent failed state, sanitized error, no partial data", async () => {
    const key = `fail-${randomUUID()}`;

    const outcome = await runHealthSequence({
      userId: devUserId,
      idempotencyKey: key,
      simulateAiFailure: true,
    });
    expect(outcome.runStatus).toBe("failed");
    expect(outcome.dbOk).toBe(true);
    expect(outcome.aiOk).toBe(false);

    const state = await dbState(key);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe("failed");
    expect(state.runs[0].error_code).toBe("AI_VALIDATION_FAILED");
    // Sanitized: stable message, no stack traces, no payload contents.
    expect(state.runs[0].error_summary).toBe(
      "System health check failed (see step records).",
    );

    expect(state.health).toHaveLength(1);
    expect(state.health[0].db_ok).toBe(true);
    expect(state.health[0].ai_mock_ok).toBe(false);

    expect(state.steps).toHaveLength(3);
    const aiStep = state.steps.find((s) => s.step_name === "check-ai-provider");
    expect(aiStep?.status).toBe("failed");
    expect(aiStep?.schema_valid).toBe(false);
    expect(aiStep?.error).toBe(
      "AI_VALIDATION_FAILED: AI output failed schema validation",
    );
    expect(aiStep?.error).not.toMatch(/at |stack|ECONN|sb_secret/i);
  });

  it("rejects an event whose userId does not resolve to a provisioned user", async () => {
    const key = `ghost-${randomUUID()}`;
    await expect(
      runHealthSequence({ userId: randomUUID(), idempotencyKey: key }),
    ).rejects.toThrow(/provisioned user/);
    const state = await dbState(key);
    expect(state.runs).toHaveLength(0);
    expect(state.health).toHaveLength(0);
  });

  it("rejects a correlation key replayed by ANOTHER user (ownership check)", async () => {
    const key = `steal-${randomUUID()}`;
    await runHealthSequence({ userId: devUserId, idempotencyKey: key });

    await expect(
      runHealthSequence({ userId: intruderUserId, idempotencyKey: key }),
    ).rejects.toThrow(/does not belong/);

    const state = await dbState(key);
    expect(state.runs).toHaveLength(1);
    expect(state.health).toHaveLength(1);
    expect(state.health[0].user_id).toBe(devUserId);
  });

  it("enforces the step state machine: a terminal step cannot change status", async () => {
    const key = `stepsm-${randomUUID()}`;
    await runHealthSequence({ userId: devUserId, idempotencyKey: key });
    const state = await dbState(key);
    const runId = state.runs[0].id;

    const { recordStep } = await import("@/lib/db/agent-ops");
    // Idempotent replay of the SAME status is allowed…
    await expect(
      recordStep({
        runId,
        userId: devUserId,
        stepName: "check-database",
        attempt: 1,
        status: "completed",
      }),
    ).resolves.toEqual({ stepStatus: "completed" });
    // …but completed → failed is an illegal transition.
    await expect(
      recordStep({
        runId,
        userId: devUserId,
        stepName: "check-database",
        attempt: 1,
        status: "failed",
      }),
    ).rejects.toThrow("Illegal step transition: completed -> failed");
  });
});
