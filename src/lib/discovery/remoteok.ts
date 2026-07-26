import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { createTtlCache } from "./cache";
import { firstPlainText } from "./html-text";
import { toPostedAt } from "./posted-at";

/**
 * Remote OK — added for BREADTH, and admitted here that it was nearly left out
 * for the wrong reason.
 *
 * It publishes no usable salary: `salary_min` and `salary_max` are 0 on every
 * one of the hundred offers measured. An earlier pass ranked sources by how
 * richly they stated pay and set this one aside on that basis — which was the
 * wrong test. An offer without a stated rate is still an offer, and the point
 * of the product is to end in a signed contract, not in a well-filtered list.
 * Something withheld can never be concluded; something shown and skipped costs
 * three seconds.
 *
 * What it brings instead: a hundred current roles per call, US-dense, answered
 * in under a second — against roughly twenty for the source with the best
 * salary data. Breadth and freshness are what it is for.
 *
 * ITS TERMS TRAVEL INSIDE THE PAYLOAD, in the first entry, and they are blunt:
 * "Please link back (with follow, and without nofollow!) to the URL on Remote
 * OK and mention Remote OK as a source... If you do not we'll have to suspend
 * API access." And: "Please don't use the Remote OK logo... please DO use our
 * name Remote OK though."
 *
 * So: the name and a FOLLOWED link are rendered (see credits.ts — the links
 * there carry `rel="noopener"` only, never `nofollow`), the logo is never
 * used, and an ad whose own URL we cannot read is dropped rather than shown
 * without the link its licence requires.
 */

const FEED_URL = "https://remoteok.com/api";
const TIMEOUT_MS = 20_000;
/** They publish no rate limit; this is our own restraint, not a probe of
 *  theirs. The feed is a rolling window, so a short TTL loses nothing. */
const CACHE_TTL_MS = 60 * 60 * 1000;

const USER_AGENT =
  "MissionPilot/1.0 (open-source job search; +https://github.com/Christophevanengelen/missionpilot)";

const offerSchema = z.object({
  position: z.string().nullish(),
  company: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  url: z.string().nullish(),
  date: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  // Present and always 0 in every sample read. Parsed anyway so that the day
  // they start filling it, the figure arrives instead of being ignored.
  salary_min: z.unknown().optional(),
  salary_max: z.unknown().optional(),
});

/** The feed is a bare ARRAY whose FIRST entry is a legal notice, not an
 *  offer. Treating it as a job would put "API Terms of Service" on screen as
 *  a position title. */
const feedSchema = z.array(z.unknown());

const legalSchema = z.object({ legal: z.string() }).partial();

export class RemoteOkError extends Error {}

const log = createLogger({ module: "discovery-remoteok" });
const resultCache = createTtlCache<DiscoveredAd[]>(CACHE_TTL_MS);

export function remoteOkConfigured(): boolean {
  return env.REMOTEOK_ENABLED === true;
}

/**
 * Their amounts are 0 when nothing was stated.
 *
 * Zero is NOT a salary of zero — it is their way of saying "unknown", and
 * carrying it through as a figure would put "0 – 0" on a card and tell someone
 * a job pays nothing. Null is the honest reading, and it is what the rest of
 * the engine already understands as "the source did not say".
 */
function statedAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * Some company and location strings arrive mojibaked — "SulAmÃ©rica" for
 * "SulAmérica" — in the source itself, not in our reading of it: UTF-8 bytes
 * that were decoded as Latin-1 somewhere upstream. Three offers in a hundred.
 *
 * We do NOT try to repair them. Re-decoding would be guesswork about what was
 * meant, and a name silently rewritten is worse than a name shown as the
 * source published it. It is displayed verbatim, mojibake and all — the ad
 * still leads to the real posting, which is what matters.
 */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/[\s,]+$/, "") ?? "";
  return trimmed === "" ? null : trimmed;
}

export function toAd(offer: z.infer<typeof offerSchema>): DiscoveredAd | null {
  const rawUrl = offer.url?.trim() ?? "";
  let sourceUrl: string | null = null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") sourceUrl = parsed.toString();
  } catch {
    sourceUrl = null;
  }
  // Their licence is a link back. An ad we cannot link to cannot be shown
  // under it, so it is dropped rather than displayed unattributed.
  if (sourceUrl === null) return null;

  const title = clean(offer.position);
  const organization = clean(offer.company);
  const description = firstPlainText(offer.description) || null;
  const locationText = clean(offer.location);

  const min = statedAmount(offer.salary_min);
  const max = statedAmount(offer.salary_max);
  // Even when an amount appears, the feed states no currency and no period, so
  // the block cannot be rendered honestly and is dropped whole. Guessing "USD
  // per year" would be inventing two thirds of a salary.
  const hasPay = false;

  const rawText = [title, organization, locationText, description, sourceUrl]
    .filter((p): p is string => typeof p === "string" && p !== "")
    .join("\n\n");

  return {
    title,
    organization,
    description,
    locationText,
    sourceUrl,
    // No employment-type field exists in this feed. Left null rather than
    // inferred from tags: "contract" as a tag describes the work, not the
    // contract, and someone filtering for missions would be misled.
    engagementType: null,
    compensationMin: hasPay ? min : null,
    compensationMax: hasPay ? max : null,
    compensationCurrency: null,
    compensationPeriod: null,
    postedAt: toPostedAt(offer.date ?? null),
    rawText,
  };
}

/**
 * The whole current feed — there is no query parameter, so keywords are not
 * sent and filtering happens in the engine's own gate, where the person can
 * see it and undo it.
 */
export async function searchRemoteOk(): Promise<DiscoveredAd[]> {
  if (!remoteOkConfigured()) {
    throw new RemoteOkError("remote ok source is not enabled");
  }
  const cached = resultCache.get(FEED_URL);
  if (cached) return cached;

  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new RemoteOkError(`remote ok: HTTP ${response.status}`);
  }
  const parsed = feedSchema.safeParse(await response.json());
  if (!parsed.success) throw new RemoteOkError("remote ok: unexpected payload");

  const ads: DiscoveredAd[] = [];
  for (const [index, entry] of parsed.data.entries()) {
    if (index === 0) {
      // The legal notice. Logged once so a change in their terms is noticed by
      // a person rather than silently accepted by a parser.
      const legal = legalSchema.safeParse(entry);
      if (legal.success && legal.data.legal) {
        log.info("remote ok terms", { legal: legal.data.legal.slice(0, 300) });
      }
      continue;
    }
    const offer = offerSchema.safeParse(entry);
    if (!offer.success) continue;
    const ad = toAd(offer.data);
    if (ad === null) continue;
    if (ad.title === null) continue;
    ads.push(ad);
  }
  resultCache.set(FEED_URL, ads);
  return ads;
}
