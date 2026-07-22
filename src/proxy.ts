import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/proxy-session";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and API routes (API routes enforce
    // their own auth via the DAL; the Inngest webhook must stay reachable).
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
