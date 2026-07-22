import { Inngest } from "inngest";
import { env } from "@/lib/env";

/**
 * Inngest v4 client. Local development sets INNGEST_DEV=1 (dev-server mode,
 * no signature verification); production forbids INNGEST_DEV and requires
 * the signing + event keys (enforced in src/lib/env-guards.ts). The serve
 * handler (app/api/inngest/route.ts) verifies request signatures with
 * INNGEST_SIGNING_KEY whenever dev mode is off.
 */
export const inngest = new Inngest({
  id: "missionpilot",
  // Strict comparison: Boolean("0")/Boolean("false") are true — only the
  // documented INNGEST_DEV=1 enables dev mode.
  isDev: env.INNGEST_DEV === "1",
  eventKey: env.INNGEST_EVENT_KEY,
});
