/**
 * Polar.sh — Merchant of Record pour le checkout WEB.
 *
 * Pourquoi Polar : il vend au client final en son nom (MoR) — il encaisse,
 * gère TVA / factures / litiges et paie un particulier. Aucune société ni
 * numéro de TVA requis de notre côté.
 *
 * Intégration zéro-SDK : REST pur + vérification HMAC standard-webhooks
 * (node:crypto) — aucune dépendance n'entre dans le bundle.
 *
 * Env (toutes optionnelles — les routes répondent 503 tant que non
 * configurées, le site peut donc shipper avant l'orga Polar) :
 *   POLAR_ACCESS_TOKEN      Dashboard → Settings → API tokens
 *   POLAR_WEBHOOK_SECRET    créé avec l'endpoint webhook (whsec_…)
 *   POLAR_PRODUCT_MONTHLY   id produit Polar de l'abo mensuel
 *   POLAR_PRODUCT_ANNUAL    id produit Polar de l'abo annuel
 *   POLAR_SERVER            "sandbox" pendant les tests (défaut : production)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE =
  process.env.POLAR_SERVER === "sandbox"
    ? "https://sandbox-api.polar.sh/v1"
    : "https://api.polar.sh/v1";

export function polarConfigured(): boolean {
  return Boolean(
    process.env.POLAR_ACCESS_TOKEN &&
    (process.env.POLAR_PRODUCT_MONTHLY || process.env.POLAR_PRODUCT_ANNUAL)
  );
}

export function polarProductId(plan: "monthly" | "annual"): string | undefined {
  return plan === "monthly"
    ? process.env.POLAR_PRODUCT_MONTHLY
    : process.env.POLAR_PRODUCT_ANNUAL;
}

/** id produit Polar → clé produit interne. */
export function toProductKey(polarProduct: string | undefined | null): string {
  if (!polarProduct) return "";
  if (polarProduct === process.env.POLAR_PRODUCT_MONTHLY) return "monthly";
  if (polarProduct === process.env.POLAR_PRODUCT_ANNUAL) return "annual";
  return polarProduct;
}

interface CreateCheckoutArgs {
  plan: "monthly" | "annual";
  userId: string;
  successUrl: string;
  customerEmail?: string | null;
}

/**
 * POST /v1/checkouts — renvoie l'URL du checkout hébergé.
 * metadata.userId revient sur chaque webhook : c'est lui qui relie le
 * paiement Polar au compte Supabase, sans table de correspondance.
 */
export async function createPolarCheckout(args: CreateCheckoutArgs): Promise<{ url: string }> {
  const productId = polarProductId(args.plan);
  if (!productId) throw new Error(`polar product not configured for plan ${args.plan}`);

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products: [productId],
      success_url: args.successUrl,
      ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
      metadata: { userId: args.userId },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`polar checkout failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("polar checkout: no url in response");
  return { url: data.url };
}

/**
 * Vérification webhook Polar (spec standard-webhooks) :
 *   contenu signé = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature     = base64(HMAC-SHA256(base64decode(secret après "whsec_")))
 *   header webhook-signature = "v1,<sig> [v1,<sig2> …]"
 * Rejette les timestamps de plus de 5 minutes (anti-replay).
 */
export function verifyPolarWebhook(
  rawBody: string,
  headers: { id?: string | null; timestamp?: string | null; signature?: string | null }
): boolean {
  const secretRaw = process.env.POLAR_WEBHOOK_SECRET;
  const { id, timestamp, signature } = headers;
  if (!secretRaw || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secret = Buffer.from(secretRaw.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  for (const part of signature.split(" ")) {
    const candidate = part.startsWith("v1,") ? part.slice(3) : part;
    const candidateBuf = Buffer.from(candidate);
    if (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return true;
    }
  }
  return false;
}

/** Statut Polar → vocabulaire interne. */
export function mapPolarStatus(polarStatus: string | undefined): string {
  switch (polarStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled":
    case "revoked": return "canceled";
    default: return polarStatus ?? "none";
  }
}
