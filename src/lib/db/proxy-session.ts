import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/db/config";

const PUBLIC_PATHS = new Set(["/", "/login"]);

/**
 * Proxy-level session refresh + OPTIMISTIC redirect (Next 16 proxy.ts).
 *
 * This is a navigation optimization, never the security boundary
 * (CVE-2025-29927 / CVE-2026-64642 were middleware bypasses). Real
 * enforcement is `verifySession()` in src/lib/auth/dal.ts, called by every
 * protected page, Server Action and Route Handler.
 *
 * Per the official @supabase/ssr guide: create the client, call auth
 * immediately, and return the supabaseResponse object unmodified — deviating
 * breaks cookie propagation and causes random logouts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not add logic between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims && !PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
