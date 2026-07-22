import { serve } from "inngest/next";
import { inngest } from "@/workflows/client";
import { functions } from "@/workflows";

/**
 * Inngest discovery/execution endpoint. Deliberately excluded from the user
 * auth proxy (src/proxy.ts matcher): its caller is Inngest, not a browser
 * session. Outside local dev mode (INNGEST_DEV, forbidden in production by
 * env-guards), serve() rejects any request that does not carry a valid
 * INNGEST_SIGNING_KEY signature.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
