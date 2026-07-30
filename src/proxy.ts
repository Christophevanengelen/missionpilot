import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/proxy-session";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and API routes (API routes enforce
    // their own auth via the DAL; the Inngest webhook must stay reachable).
    //
    // LES FICHIERS DE ROBOTS SONT EXCLUS ICI, et pas seulement déclarés
    // publics : constaté le 2026-07-30, `/robots.txt` et `/sitemap.xml`
    // répondaient 307 vers `/login`. Vingt-sept passages de moteurs de
    // recherche, tous refoulés — le produit était invisible par accident de
    // configuration, pas par choix.
    //
    // Exclure du filtre plutôt qu'ajouter à `PUBLIC_PATHS` : un robot n'a pas
    // de session à rafraîchir, et lui faire payer un aller-retour Supabase
    // pour lire trois lignes de règles n'a aucun sens. Même raison pour
    // l'image Open Graph, qui est demandée par les réseaux sociaux à chaque
    // partage de lien.
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|opengraph-image|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
