import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { boundedAmount } from "./amount";
import { createTtlCache } from "./cache";
import { firstPlainText } from "./html-text";
import { isExpired, toPostedAt } from "./posted-at";

/**
 * Himalayas connector — a legal remote-work source with a PUBLIC, documented,
 * unauthenticated API (himalayas.app/docs/remote-jobs-api). No scraping.
 *
 * Why it earns its place: it is the only source in the audited landscape that
 * states, as STRUCTURED FIELDS, the three things this product refuses to
 * guess — `employmentType` (including "Contractor"), a real salary range with
 * its currency and period, and the geographic/timezone restrictions that
 * decide whether a European freelance may even take the role.
 *
 * ToS-DRIVEN CONSTRAINTS (verified on their API docs):
 * - Attribution + link-back are REQUIRED: the source name is recorded on every
 *   imported opportunity and displayed, and an ad we cannot link back to is
 *   DROPPED rather than imported without its provenance.
 * - Their listings must not be resubmitted to third-party job boards. We only
 *   ever surface them inside the user's OWN private inbox.
 * - The data is cached and refreshed every 24h on their side, and the endpoint
 *   is rate limited (429). Discovery here is user-triggered and rare; there is
 *   NO background polling.
 *
 * Opt-in: inert unless HIMALAYAS_ENABLED is set, so a deployment accepts those
 * terms explicitly rather than inheriting them silently (same posture as
 * Remotive).
 */

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const TIMEOUT_MS = 15_000;
/** Their documented maximum page size; asking for more is silently capped. */
const RESULTS_PER_PAGE = 20;

const jobSchema = z.object({
  title: z.string().nullish(),
  companyName: z.string().nullish(),
  description: z.string().nullish(),
  excerpt: z.string().nullish(),
  employmentType: z.string().nullish(),
  // Deliberately unvalidated here, and bounded by `boundedAmount` instead.
  // `z.number()` rejects Infinity, which `JSON.parse('{"n":1e400}')` produces —
  // and a schema failure voids the WHOLE response, so one absurd figure in one
  // listing would cost us the other nineteen. Drop the figure, keep the batch.
  minSalary: z.unknown().optional(),
  maxSalary: z.unknown().optional(),
  currency: z.string().nullish(),
  salaryPeriod: z.string().nullish(),
  seniority: z.array(z.string()).nullish(),
  locationRestrictions: z.array(z.string()).nullish(),
  timezoneRestrictions: z.array(z.number()).nullish(),
  applicationLink: z.string().nullish(),
  guid: z.string().nullish(),
  pubDate: z.unknown().optional(),
  expiryDate: z.unknown().optional(),
});

// `jobs` is REQUIRED, deliberately without a default: an error envelope that
// carries no `jobs` key must fail loudly rather than be read as "0 result",
// which would tell the user their profile matched nothing. Same trap Jobicy
// walks into with its HTTP-200 errors.
const responseSchema = z.object({ jobs: z.array(jobSchema) });

export class HimalayasError extends Error {}

const log = createLogger({ module: "discovery-himalayas" });

/** Their data refreshes every 24h on their side; six hours keeps repeated runs
 *  free without ever serving something they would call stale. */
const resultCache = createTtlCache<DiscoveredAd[]>(6 * 60 * 60 * 1000);

export function himalayasConfigured(): boolean {
  return env.HIMALAYAS_ENABLED === true;
}

/** Currencies our domain can store; anything else stays honestly unknown
 *  rather than being coerced into the wrong symbol. */
const SUPPORTED_CURRENCIES = new Set(["EUR", "USD", "GBP", "CHF", "CAD"]);

/** Their `salaryPeriod` vocabulary mapped onto ours. "fortnightly" and
 *  "weekly" have no equivalent in our domain, so a figure carrying them is
 *  dropped entirely instead of being silently relabelled. */
/**
 * Their period vocabulary. `hourly` is mapped now, and it was the expensive
 * omission: a US contract at 140 USD/hour is exactly the kind of well-paid
 * remote role this product is for, and it was arriving with its salary
 * silently discarded because the unit was not in this list.
 */
function mapPeriod(
  period: string | null | undefined,
): "year" | "month" | "hour" | null {
  const p = period?.trim().toLowerCase();
  if (p === "annual") return "year";
  if (p === "monthly") return "month";
  if (p === "hourly") return "hour";
  return null;
}

/** Honest mapping of their employmentType vocabulary; anything unexpected
 *  stays null rather than being guessed. */
function mapEngagement(
  employmentType: string | null | undefined,
): DiscoveredAd["engagementType"] {
  switch (employmentType?.trim().toLowerCase()) {
    case "full time":
      return "permanent";
    case "part time":
      return "part_time";
    case "contractor":
      return "freelance";
    case "temporary":
      return "interim";
    default:
      return null;
  }
}

function toAd(j: z.infer<typeof jobSchema>): DiscoveredAd {
  const title = j.title?.trim() || null;
  const organization = j.companyName?.trim() || null;
  // BOTH candidates go through the cleaner. Cleaning only the first would let
  // a hostile `excerpt` carry never-displayed text — "TJM : 2000 EUR" — into
  // the description, where the extractor would read it as a stated fact.
  const description = firstPlainText(j.description, j.excerpt);
  const seniority = j.seniority?.filter((s) => s.trim() !== "") ?? [];
  const locations =
    j.locationRestrictions?.filter((l) => l.trim() !== "") ?? [];
  const zones = j.timezoneRestrictions ?? [];
  // Their remote roles are worldwide unless restricted; the restriction list
  // IS the location statement, so it is preserved verbatim rather than
  // flattened into a single city string we would have invented.
  const locationText =
    locations.length > 0 ? locations.join(", ").slice(0, 300) : null;

  const period = mapPeriod(j.salaryPeriod);
  const currency = j.currency?.trim().toUpperCase() ?? "";
  // A figure is kept ONLY when its currency AND period are both expressible in
  // our domain: a number without a unit is not a fact, it is a trap.
  const hasUsableUnits = period !== null && SUPPORTED_CURRENCIES.has(currency);
  let min = hasUsableUnits ? boundedAmount(j.minSalary) : null;
  let max = hasUsableUnits ? boundedAmount(j.maxSalary) : null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const hasSalary = min !== null || max !== null;

  const rawText = [
    title,
    organization ? `chez ${organization}` : null,
    locationText ? `Zones autorisées : ${locationText}` : "Télétravail",
    zones.length > 0
      ? `Fuseaux horaires : ${zones.map((z) => `UTC${z >= 0 ? "+" : ""}${z}`).join(", ")}`
      : null,
    j.employmentType ? `Type : ${j.employmentType}` : null,
    seniority.length > 0 ? `Séniorité : ${seniority.join(", ")}` : null,
    "",
    description,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")
    .slice(0, 100_000);

  // `guid` is the HIMALAYAS posting URL — the link their attribution terms ask
  // for. `applicationLink` is the APPLY destination, which is frequently the
  // employer's own ATS: crediting Himalayas with a link to Greenhouse would
  // satisfy nobody. They currently coincide on most rows, which is exactly why
  // this must be explicit rather than left to luck.
  const link = j.guid?.trim() || j.applicationLink?.trim() || null;
  return {
    title,
    organization,
    description,
    locationText,
    // Attribution: the link back to the original posting is required by ToS
    // and is the provenance we display. Only http(s) is kept (defense in
    // depth — it is rendered as text, but a javascript: value has no business
    // being stored either).
    sourceUrl: link && /^https?:\/\//i.test(link) ? link : null,
    engagementType: mapEngagement(j.employmentType),
    compensationMin: min,
    compensationMax: max,
    compensationCurrency: hasSalary
      ? (currency as "EUR" | "USD" | "GBP" | "CHF")
      : null,
    compensationPeriod: hasSalary ? period : null,
    postedAt: toPostedAt(j.pubDate),
    rawText,
  };
}

/**
 * Search Himalayas for remote roles matching the keywords. Throws
 * `HimalayasError` on config/HTTP/shape problems (the caller isolates it, so
 * one failing source never voids the others).
 */
export async function searchHimalayas(
  keywords: string[],
): Promise<DiscoveredAd[]> {
  if (!himalayasConfigured()) {
    throw new HimalayasError("himalayas source is not enabled");
  }
  const query = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!query) throw new HimalayasError("no keywords to search");

  const cached = resultCache.get(query);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query,
    limit: String(RESULTS_PER_PAGE),
  });

  let body: unknown;
  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // 429 is their documented rate limit — the status alone is enough to
      // tell it apart from a shape problem, and carries no secret.
      log.warn("himalayas request failed", { httpStatus: response.status });
      throw new HimalayasError(`himalayas request failed (${response.status})`);
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof HimalayasError) throw error;
    log.warn("himalayas request errored", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new HimalayasError("himalayas request errored");
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("himalayas response failed validation", {});
    throw new HimalayasError("himalayas response failed validation");
  }
  const ads = parsed.data.jobs
    .slice(0, RESULTS_PER_PAGE)
    // An offer past its stated expiry has no business in a view of what is
    // open RIGHT NOW. Himalayas is the only source that states one, so this is
    // a bonus where available — never an assumption applied elsewhere.
    .filter((j) => !isExpired(j.expiryDate))
    .map(toAd)
    // ToS: attribution + link-back is REQUIRED, so an ad we cannot link back
    // to is dropped rather than imported without its provenance. Also drops
    // records with no readable content (nothing to snapshot honestly).
    .filter((ad) => ad.sourceUrl !== null && ad.title !== null)
    .filter((ad) => ad.rawText.trim() !== "");
  // Only a SUCCESSFUL answer is cached: caching a failure would turn a
  // transient outage into hours of silent emptiness.
  resultCache.set(query, ads);
  return ads;
}
