import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { boundedAmount } from "./amount";
import { createTtlCache } from "./cache";
import { firstPlainText } from "./html-text";
import { toPostedAt } from "./posted-at";

/**
 * Jobicy connector — a legal remote-work source with a PUBLIC, documented,
 * unauthenticated API (jobicy.com/jobs-rss-feed). No scraping.
 *
 * Why it earns its place: a `jobType` vocabulary that actually distinguishes
 * freelance and contract work from salaried posts, and structured salary
 * bounds — which is what makes "well paid" something the engine can rank on
 * rather than guess at.
 *
 * ToS-DRIVEN CONSTRAINTS — Jobicy states them INSIDE the payload itself
 * (`friendlyNotice`), which is as explicit as it gets:
 * - Jobicy must be "clearly credited with a direct link to the source": the
 *   source name is recorded on every imported opportunity and displayed, and
 *   an ad we cannot link back to is DROPPED rather than imported without its
 *   provenance.
 * - "All application buttons redirect to the original job URL." MissionPilot
 *   never submits an application and never proxies one — the user applies from
 *   the original posting. Satisfied by construction.
 * - Their docs ask for at most one feed check per hour and note that "a few
 *   times a day is sufficient". Discovery is user-triggered and rare; there is
 *   NO background polling.
 *
 * Opt-in: inert unless JOBICY_ENABLED is set, so a deployment accepts those
 * terms explicitly rather than inheriting them silently.
 */

const SEARCH_URL = "https://jobicy.com/api/v2/remote-jobs";
const TIMEOUT_MS = 15_000;
/** Their documented maximum page size. */
const RESULTS_PER_PAGE = 20;
/**
 * NO geographic filter, deliberately.
 *
 * This used to be pinned to `geo=europe`, which silently discarded every
 * American and Canadian remote role BEFORE the engine ever saw one — a
 * restriction applied at the source, where nobody could see it or undo it.
 *
 * For remote work the country of the employer is not a constraint on the
 * candidate; it is a fact about the offer, and facts belong in the filters the
 * person can actually operate. So the query asks for everything and the
 * engine's own gate decides — which is also the only arrangement where
 * changing your mind costs a click instead of a deployment.
 */

const jobSchema = z.object({
  jobTitle: z.string().nullish(),
  companyName: z.string().nullish(),
  jobDescription: z.string().nullish(),
  jobExcerpt: z.string().nullish(),
  jobType: z.array(z.string()).nullish(),
  jobGeo: z.string().nullish(),
  jobLevel: z.string().nullish(),
  url: z.string().nullish(),
  // Same reasoning as Himalayas: a bad figure must cost us that figure, not
  // the whole response. `toNumber` + `boundedAmount` do the validating.
  salaryMin: z.unknown().optional(),
  salaryMax: z.unknown().optional(),
  salaryCurrency: z.string().nullish(),
  salaryPeriod: z.string().nullish(),
  pubDate: z.unknown().optional(),
});

// `jobs` is REQUIRED, deliberately without a default: Jobicy answers a
// rejected filter with HTTP 200 and {success:false,error}, which carries no
// `jobs` key. Defaulting it to [] would turn their error into a silent "no
// offer matched your profile" — a different and false statement.
const responseSchema = z.object({ jobs: z.array(jobSchema) });

export class JobicyError extends Error {}

const log = createLogger({ module: "discovery-jobicy" });

/** Their docs ask for at most one feed check per hour — so an identical query
 *  costs them nothing more than that, however often the owner clicks. */
const resultCache = createTtlCache<DiscoveredAd[]>(60 * 60 * 1000);

export function jobicyConfigured(): boolean {
  return env.JOBICY_ENABLED === true;
}

const SUPPORTED_CURRENCIES = new Set(["EUR", "USD", "GBP", "CHF", "CAD"]);

/**
 * Jobicy's period vocabulary is NOT Himalayas' ("yearly" here, "annual"
 * there). Mapping it by assumption rather than by observation is exactly how a
 * yearly figure becomes a fabricated day rate, so anything outside the values
 * we have actually seen returns null and the whole salary block is dropped.
 */
function mapPeriod(
  period: string | null | undefined,
): "year" | "month" | "hour" | null {
  switch (period?.trim().toLowerCase()) {
    case "yearly":
      return "year";
    case "monthly":
      return "month";
    case "hourly":
      return "hour";
    default:
      return null;
  }
}

/** Honest mapping of their jobType vocabulary; anything unexpected stays null
 *  rather than being guessed. Values arrive title-cased ("Full-Time"). */
function mapEngagement(
  jobTypes: string[] | null | undefined,
): DiscoveredAd["engagementType"] {
  const types = (jobTypes ?? []).map((t) => t.trim().toLowerCase());
  // Freelance first: an ad tagged both freelance and full-time is a mission
  // for our user, and calling it "permanent" would misfile it.
  if (types.includes("freelance")) return "freelance";
  if (types.includes("contract") || types.includes("temporary"))
    return "interim";
  if (types.includes("part-time")) return "part_time";
  if (types.includes("full-time")) return "permanent";
  return null;
}

/** Their salary numbers arrive as either a number or a numeric string. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toAd(j: z.infer<typeof jobSchema>): DiscoveredAd {
  const title = j.jobTitle?.trim() || null;
  const organization = j.companyName?.trim() || null;
  // Both candidates cleaned, and an empty result becomes null rather than an
  // empty string: `""` would read downstream as "stated, and blank" instead of
  // "the source did not say", and would shadow a usable excerpt.
  const description = firstPlainText(j.jobDescription, j.jobExcerpt);
  // `jobGeo` is a comma-separated eligibility list ("France,  Ireland,  UK"),
  // not a workplace address. Collapse its ragged spacing but keep it verbatim
  // otherwise — it is the source's own statement of where one may work from.
  const locationText =
    j.jobGeo
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, 300) || null;
  const level = j.jobLevel?.trim() || null;

  const period = mapPeriod(j.salaryPeriod);
  const currency = j.salaryCurrency?.trim().toUpperCase() ?? "";
  // A figure without an expressible unit is not a fact — the whole block goes.
  const hasUsableUnits = period !== null && SUPPORTED_CURRENCIES.has(currency);
  let min = hasUsableUnits ? boundedAmount(toNumber(j.salaryMin)) : null;
  let max = hasUsableUnits ? boundedAmount(toNumber(j.salaryMax)) : null;
  // Jobicy uses 0 as "not stated" rather than "unpaid".
  if (min === 0) min = null;
  if (max === 0) max = null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const hasSalary = min !== null || max !== null;

  const rawText = [
    title,
    organization ? `chez ${organization}` : null,
    locationText ? `Zones autorisées : ${locationText}` : "Télétravail",
    (j.jobType ?? []).length > 0 ? `Type : ${j.jobType!.join(", ")}` : null,
    level ? `Séniorité : ${level}` : null,
    "",
    description,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")
    .slice(0, 100_000);

  const url = j.url?.trim() || null;
  return {
    title,
    organization,
    description,
    locationText,
    sourceUrl: url && /^https?:\/\//i.test(url) ? url : null,
    engagementType: mapEngagement(j.jobType),
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
 * Search Jobicy for European remote roles matching the keywords. Throws
 * `JobicyError` on config/HTTP/shape problems (the caller isolates it).
 */
export async function searchJobicy(
  keywords: string[],
): Promise<DiscoveredAd[]> {
  if (!jobicyConfigured()) {
    throw new JobicyError("jobicy source is not enabled");
  }
  const tag = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!tag) throw new JobicyError("no keywords to search");

  const cached = resultCache.get(tag);
  if (cached) return cached;

  const params = new URLSearchParams({
    tag,
    count: String(RESULTS_PER_PAGE),
  });

  let body: unknown;
  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      log.warn("jobicy request failed", { httpStatus: response.status });
      throw new JobicyError(`jobicy request failed (${response.status})`);
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof JobicyError) throw error;
    log.warn("jobicy request errored", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new JobicyError("jobicy request errored");
  }

  // Jobicy answers a rejected filter with HTTP 200 and {success:false,error},
  // which has no `jobs` array — the schema turns that into a validation
  // failure rather than a silent empty result that would read as "no match".
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("jobicy response failed validation", {});
    throw new JobicyError("jobicy response failed validation");
  }
  const ads = parsed.data.jobs
    .slice(0, RESULTS_PER_PAGE)
    .map(toAd)
    // ToS: credit with a DIRECT LINK to the source. An ad we cannot link
    // back to is dropped rather than imported without its provenance.
    .filter((ad) => ad.sourceUrl !== null && ad.title !== null)
    .filter((ad) => ad.rawText.trim() !== "");
  // Only a SUCCESSFUL answer is cached: caching a failure would turn a
  // transient outage into an hour of silent emptiness.
  resultCache.set(tag, ads);
  return ads;
}
