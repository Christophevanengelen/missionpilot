import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/admin";
import {
  mapPolarStatus,
  toProductKey,
  verifyPolarWebhook,
} from "@/lib/billing/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/webhook/polar — la source de vérité Revenue.
 *
 * Pipeline en trois temps, chacun avec sa raison :
 *   1. SIGNATURE (standard-webhooks). Sans elle, cette route serait un
 *      guichet ouvert : n'importe qui pourrait se déclarer abonné.
 *   2. IDEMPOTENCE. L'événement est "claimé" dans billing_events via la
 *      contrainte d'unicité (source, event_id) : Polar retente ses
 *      livraisons, nous ne rejouons jamais un effet.
 *   3. VERSIONNEMENT. subscriptions n'accepte une écriture que si le
 *      timestamp de l'événement est plus récent que la ligne : un retry
 *      livré hors ordre ne fait jamais régresser l'état.
 *
 * NOTE TYPES. Les tables billing_events / subscriptions n'existent pas
 * encore dans database.types.ts (généré) : le client passe par `from()`
 * non typé le temps d'une régénération locale des types — le schéma, lui,
 * est déjà garanti par la migration.
 */

interface AbonnementPolar {
  id: string;
  status?: string;
  metadata?: { userId?: string };
  customer_id?: string;
  customer?: { id?: string };
  product_id?: string;
  product?: { id?: string };
  current_period_end?: string | null;
}

interface EvenementPolar {
  type: string;
  data: AbonnementPolar;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const corpsBrut = await request.text();

  const signatureValide = verifyPolarWebhook(corpsBrut, {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  });
  if (!signatureValide) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  let evenement: EvenementPolar;
  try {
    evenement = JSON.parse(corpsBrut) as EvenementPolar;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Le client service contourne la RLS — c'est le SEUL écrivain de ces
  // tables. Cast local le temps que les types générés rattrapent le schéma.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const idEvenement =
    request.headers.get("webhook-id") ?? `polar_${crypto.randomUUID()}`;
  const horodatage = new Date(
    Number(request.headers.get("webhook-timestamp")) * 1000 || Date.now(),
  ).toISOString();

  // ── 2. Idempotence : claim ou no-op ──
  const { data: claim } = await db
    .from("billing_events")
    .insert({
      source: "polar",
      event_id: idEvenement,
      event_type: evenement.type,
      event_timestamp: horodatage,
      payload: evenement,
    })
    .select("id")
    .maybeSingle();
  if (!claim) {
    return new NextResponse("ok", { status: 200 }); // déjà traité
  }

  // ── 3. Effet : uniquement les événements d'abonnement ──
  const TYPES_ABONNEMENT = new Set([
    "subscription.created",
    "subscription.updated",
    "subscription.active",
    "subscription.canceled",
    "subscription.revoked",
  ]);
  if (TYPES_ABONNEMENT.has(evenement.type)) {
    const abo = evenement.data;
    const userId = abo.metadata?.userId;
    if (userId) {
      const { data: existante } = await db
        .from("subscriptions")
        .select("version_timestamp")
        .eq("user_id", userId)
        .maybeSingle();

      const plusRecent =
        !existante ||
        new Date(horodatage) > new Date(existante.version_timestamp as string);

      if (plusRecent) {
        await db.from("subscriptions").upsert({
          user_id: userId,
          plan: toProductKey(abo.product_id ?? abo.product?.id),
          status: mapPolarStatus(abo.status),
          polar_subscription_id: abo.id,
          polar_customer_id: abo.customer_id ?? abo.customer?.id ?? null,
          current_period_end: abo.current_period_end ?? null,
          version_timestamp: horodatage,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      console.warn("[billing/webhook] abonnement sans metadata.userId", abo.id);
    }
  }

  return new NextResponse("ok", { status: 200 });
}
