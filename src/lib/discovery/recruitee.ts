import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { createTtlCache } from "./cache";
import { activeTenants } from "./recruitee-tenants";
import { offerSchema, toAd } from "./recruitee-normalise";

/**
 * Recruitee (Tellent) connector — the first source that reaches EUROPEAN LOCAL
 * employers rather than the worldwide remote pool.
 *
 * The gap it closes: until now the engine only saw Himalayas and Jobicy, both
 * remote-first and measurably US-skewed. Someone looking for work in Ghent was
 * being shown San Francisco.
 *
 * WHY THIS ONE, out of five European ATSs probed by real calls: it is the only
 * one where all ten fields of the normalisation contract have a real origin in
 * the response — salary included — and where the outbound URL to the ORIGINAL
 * posting is native rather than reconstructed. A source whose apply link has to
 * be guessed from a URL pattern breaks silently the day the pattern changes,
 * and the product's whole promise is that you land on the real ad.
 *
 * ITS OPENNESS IS STATED, not merely tolerated. Recruitee's own documentation:
 * "This API does not require authorization and is available under your Careers
 * Site address"; and their terms, article 2.9: the careers site "is intended,
 * among other things, to provide the public with a list of job opportunities,
 * and therefore Subscriber's usage of the Careers Site is not intended to be
 * private". No attribution clause exists — which is not a permission to erase
 * the employer: `company_name` and the outbound link are always rendered.
 *
 * WHAT THIS CONNECTOR REFUSES TO DO, and each refusal is load-bearing:
 * - It calls ONE path, `/api/offers/`. Never page HTML, never `/v/` (the only
 *   path their robots.txt disallows), never the per-offer endpoint — verified
 *   to add nothing at all (56 keys on both sides, byte-identical values).
 * - It never follows `careers_apply_url`. MissionPilot does not apply.
 * - It drops `mailbox_email` at ingestion: the payload carries a real address,
 *   and it is neither stored, nor shown, nor logged.
 * - It never probes rate limits. No limit is documented, so the connector
 *   bounds ITSELF and caches per tenant.
 *
 * Opt-in via RECRUITEE_ENABLED, like every other source: a deployment accepts
 * these obligations deliberately instead of inheriting them by existing.
 */

/**
 * Five seconds, measured rather than chosen.
 *
 * At fifteen, a single unresponsive subdomain held its whole batch for fifteen
 * seconds, and the dashboard took 25 s to render in production on 2026-07-29 —
 * long enough that the page reads as broken. A tenant that has not answered in
 * five seconds is not going to make this page better; it is going to make it
 * unusable.
 */
const TIMEOUT_MS = 5_000;
/** Their API is documented as "still a work in progress": nothing here may
 *  assume a frozen schema. Unknown keys are ignored, unknown enum values become
 *  null and are logged verbatim rather than mapped by guesswork. */
const CACHE_TTL_MS = 30 * 60 * 1000;
/**
 * A tenant that just failed is very unlikely to succeed thirty seconds later —
 * the list is curated offline, so the usual cause is a subdomain that no longer
 * exists. Without this, EVERY visit re-pays the full timeout for every dead
 * tenant, which is the part that made the slowness feel permanent rather than
 * occasional.
 *
 * Shorter than the success TTL on purpose: a real outage should heal on its own
 * within the visit after it ends, without a deploy.
 */
const FAILURE_TTL_MS = 10 * 60 * 1000;
/**
 * No rate limit is published, so we set our own and never test theirs.
 *
 * MONTÉ À 24 LE 2026-07-29, REDESCENDU À 6 UNE HEURE PLUS TARD. Le raisonnement
 * qui a justifié la hausse — « chaque requête d'une vague vise un sous-domaine
 * DIFFÉRENT, donc c'est un hôte servi une fois, pas un hôte servi vingt-quatre
 * fois » — était faux. Recruitee sert tous ses tenants depuis la même
 * infrastructure et compte par appelant : dix-neuf tenants ont répondu HTTP 429
 * et l'écran ne montrait plus AUCUNE offre.
 *
 * La phrase ci-dessus disait « never test theirs ». Je l'ai testée, en
 * production, et la source nous a fermé la porte.
 *
 * Six et non huit : on vient de cogner sur cette API, on lui rend du crédit. Et
 * la latence ne venait de toute façon pas d'ici — Recruitee traitait ses 219
 * lignes en 0,8 seconde sur un rendu de 25 secondes.
 */
const MAX_CONCURRENT_TENANTS = 6;

/**
 * A User-Agent that says who is calling and how to object.
 *
 * The counterpart of C8: an employer told to "contact them directly" has to be
 * able to work out who "them" is from their own server logs.
 */
const USER_AGENT =
  "MissionPilot/1.0 (open-source job search; +https://github.com/Christophevanengelen/missionpilot)";

/**
 * Les deux bornes qui décident du temps d'attente, exposées pour être
 * VÉRIFIÉES plutôt que recopiées dans un test. Une valeur dupliquée dans une
 * assertion cesse d'être un garde-fou dès qu'on la change d'un seul côté.
 */
export const LIMITES_LATENCE = {
  TIMEOUT_MS,
  MAX_CONCURRENT_TENANTS,
} as const;

export class RecruiteeError extends Error {}

const log = createLogger({ module: "discovery-recruitee" });

const resultCache = createTtlCache<DiscoveredAd[]>(CACHE_TTL_MS);
/** Kept separate from `resultCache` so a tenant that legitimately has zero
 *  openings stays distinguishable from one we could not reach. Conflating them
 *  would hide a dying subdomain behind "nothing matched you". */
const failureCache = createTtlCache<true>(FAILURE_TTL_MS);

export function recruiteeConfigured(): boolean {
  return env.RECRUITEE_ENABLED === true && activeTenants().length > 0;
}

/** `offers` is REQUIRED and has no default: a tenant that answers with a
 *  different envelope is a failure to report, not an empty result to display
 *  as "nothing matched you". */
const responseSchema = z.object({ offers: z.array(offerSchema) });

async function fetchTenant(tenant: string): Promise<DiscoveredAd[]> {
  const cached = resultCache.get(tenant);
  if (cached) return cached;
  // A tenant known to be failing costs nothing until its window expires. This
  // is what stops a handful of dead subdomains from taxing every single visit.
  if (failureCache.get(tenant)) return [];

  const url = `https://${tenant}.recruitee.com/api/offers/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new RecruiteeError(`recruitee ${tenant}: HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new RecruiteeError(`recruitee ${tenant}: unexpected payload`);
    }
    const ads: DiscoveredAd[] = [];
    for (const offer of parsed.data.offers) {
      const { ad, unknownEngagement } = toAd(offer);
      if (unknownEngagement !== null) {
        // Logged verbatim so a new contract type is noticed and mapped
        // deliberately, instead of being guessed at here.
        log.info("unmapped recruitee employment type", {
          tenant,
          code: unknownEngagement,
        });
      }
      // An ad with no title and no link cannot be shown honestly.
      if (ad.title === null && ad.sourceUrl === null) continue;
      ads.push(ad);
    }
    resultCache.set(tenant, ads);
    return ads;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search every curated tenant and return their offers.
 *
 * The keywords are NOT sent: Recruitee exposes no keyword, location or date
 * filter, and its only working server filter (`?department=`) answers a
 * misspelling with HTTP 200 and an empty array — a silent failure that would
 * read as "nothing matched you". Filtering therefore happens where it can be
 * explained, in the engine's own deterministic gate.
 *
 * One failing tenant never sinks the others: a dead subdomain is normal in a
 * list curated offline, and it must cost that tenant's results, not the search.
 */
export async function searchRecruitee(): Promise<DiscoveredAd[]> {
  const tenants = activeTenants();
  const ads: DiscoveredAd[] = [];
  for (let i = 0; i < tenants.length; i += MAX_CONCURRENT_TENANTS) {
    const batch = tenants.slice(i, i + MAX_CONCURRENT_TENANTS);
    const settled = await Promise.allSettled(batch.map(fetchTenant));
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        ads.push(...result.value);
        return;
      }
      // Remembered as failing, so the next visitor does not wait on it again.
      failureCache.set(batch[index], true);
      log.warn("recruitee tenant failed", {
        tenant: batch[index],
        reason:
          result.reason instanceof Error ? result.reason.message : "unknown",
      });
    });
  }
  return ads;
}
