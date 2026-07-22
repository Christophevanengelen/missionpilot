"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { inngest } from "@/workflows/client";
import { createLogger } from "@/lib/observability/logger";

export type TriggerState = {
  ok: boolean | null;
  message: string | null;
};

/**
 * Triggers a system-health run for the AUTHENTICATED user only: the userId
 * in the event comes from the DAL-verified session, never from the client.
 * Each click is a new logical check (fresh idempotency key); replay
 * protection for a given key is exercised by the integration tests.
 */
export async function triggerHealthCheck(): Promise<TriggerState> {
  const session = await verifySession();
  const idempotencyKey = `ui-${randomUUID()}`;
  const log = createLogger({
    module: "diagnostics",
    correlationId: `health-${idempotencyKey}`,
  });

  try {
    await inngest.send({
      id: `health-${idempotencyKey}`,
      name: "system/health.requested",
      data: {
        userId: session.userId,
        idempotencyKey,
      },
    });
  } catch {
    log.error("health check dispatch failed");
    return {
      ok: false,
      message:
        "Could not reach the workflow engine. Locally, make sure the Inngest dev server is running (pnpm inngest:dev).",
    };
  }

  log.info("health check requested");
  revalidatePath("/diagnostics");
  return { ok: true, message: "Health check requested." };
}
