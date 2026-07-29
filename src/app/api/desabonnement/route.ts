import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/admin";
import { desabonnerParJeton } from "@/lib/digest/abonnement";

/**
 * Le désabonnement en UN CLIC, pour les clients de messagerie (RFC 8058).
 *
 * POURQUOI CETTE ROUTE EXISTE À CÔTÉ DE LA PAGE. L'en-tête
 * `List-Unsubscribe-Post` fait apparaître le bouton « Se désabonner » natif de
 * Gmail et d'Apple Mail — celui qui est juste à côté de « Signaler comme
 * spam », et qui doit être le plus facile des deux. Mais ces clients envoient
 * un **POST**, et une page Next répond aux GET : déclarer l'en-tête sans
 * quelqu'un pour recevoir le POST donnerait un 405 au destinataire, donc un
 * bouton natif qui échoue, donc le bouton d'à côté.
 *
 * Deux verbes, deux publics :
 * - POST : la machine. On répond 200 et rien d'autre.
 * - GET : un humain qui a collé l'URL. On l'emmène sur la page qui explique.
 *
 * Le jeton n'authentifie personne et n'ouvre aucune donnée. Il désabonne, et
 * c'est tout ce qu'il peut faire.
 */

/** `dynamic` explicite : cette route lit une query et écrit en base, elle ne
 *  doit jamais être mise en cache ni pré-rendue. */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const jeton = request.nextUrl.searchParams.get("jeton") ?? "";
  await desabonnerParJeton(createServiceClient(), jeton);
  // 200 QUOI QU'IL ARRIVE, et c'est délibéré. Un 404 sur jeton inconnu
  // transformerait cette route en oracle : « ce jeton existe-t-il ? ». Le
  // client de messagerie, lui, n'a que faire de la nuance — il veut savoir que
  // sa demande est passée.
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const jeton = request.nextUrl.searchParams.get("jeton") ?? "";
  const url = request.nextUrl.clone();
  url.pathname = "/desabonnement";
  url.search = jeton === "" ? "" : `?jeton=${encodeURIComponent(jeton)}`;
  return NextResponse.redirect(url);
}
