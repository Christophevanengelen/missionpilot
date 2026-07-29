import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/db/config";

/**
 * `/auth/confirm` est public POUR UNE RAISON PRÉCISE : c'est le retour du lien
 * magique, et au moment du clic aucune session n'existe encore. Le protéger
 * comme les autres renverrait la personne vers la connexion AVANT que la
 * session soit créée — elle cliquerait sur son lien pour retomber d'où elle
 * vient, redemanderait un lien, et recommencerait sans qu'un seul message ne
 * lui dise pourquoi. C'est la panne la plus muette que ce produit puisse
 * produire, et elle tient à cette ligne.
 */
/* `/au-revoir` est public à dessein : on y arrive PRÉCISÉMENT au moment où le
   compte n'existe plus. Protégée, la page renverrait vers la connexion la
   personne qui vient de tout supprimer — le seul écran qui devait lui confirmer
   que son geste a abouti serait le seul qu'elle ne verrait jamais.
   Le `Set` est interrogé par `.has(pathname)` : correspondance exacte, aucun
   élargissement par préfixe. */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/auth/confirm",
  "/au-revoir",
  /* Les documents juridiques sont publics par obligation autant que par
     principe : on doit pouvoir lire ce qu'un service fera de ses données AVANT
     de lui en confier. Une politique de confidentialité derrière une connexion
     ne remplit pas l'art. 12(1), et LinkedIn vérifie d'ailleurs qu'elle est
     accessible sans authentification. */
  "/confidentialite",
  "/conditions",
  /* Se désabonner ne demande PAS de se connecter, et c'est une règle, pas une
     facilité. Renvoyer vers la connexion quelqu'un qui veut arrêter de recevoir
     des e-mails ne le garde pas abonné : ça le pousse vers le bouton « spam »,
     qui abîme la délivrabilité du domaine entier — liens de connexion compris.
     La sortie doit toujours être plus facile que le signalement. */
  "/desabonnement",
]);

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
