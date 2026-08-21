import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createPolarCheckout, polarConfigured } from "@/lib/billing/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout — ouvre un checkout Polar hébergé.
 *
 * Body : { plan?: "monthly" | "annual" } (mensuel par défaut).
 *
 * DORMANTE PAR CONSTRUCTION. Tant que les variables Polar ne sont pas
 * posées, la route répond 503 `paymentNotConfigured` : le code peut vivre
 * en production avant l'ouverture commerciale, l'activation est un geste
 * de configuration — pas un déploiement.
 *
 * L'utilisateur doit être connecté : le checkout embarque son user_id en
 * metadata, et c'est ce fil-là que le webhook remonte pour marquer le
 * compte Pro. Pas de compte, pas de fil — donc 401.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!polarConfigured()) {
    return NextResponse.json(
      { error: "paymentNotConfigured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "notAuthenticated" }, { status: 401 });
  }

  let plan: "monthly" | "annual" = "monthly";
  try {
    const body = (await request.json()) as { plan?: string };
    if (body.plan === "annual") plan = "annual";
  } catch {
    // corps absent — mensuel par défaut, et c'est très bien comme ça
  }

  const origin = request.nextUrl.origin;
  try {
    const { url } = await createPolarCheckout({
      plan,
      userId: user.id,
      customerEmail: user.email ?? null,
      successUrl: `${origin}/?facturation=ok`,
    });
    return NextResponse.json({ url });
  } catch (erreur) {
    console.error("[billing/checkout]", erreur);
    return NextResponse.json({ error: "checkoutError" }, { status: 500 });
  }
}
