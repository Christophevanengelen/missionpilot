import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";

/**
 * Adzuna connector — the first auto-discovery source (owner decision: legal
 * sources only; Adzuna is an aggregator with an OFFICIAL free API, so access
 * is ToS-permissive by construction). Server-only; the app id/key exist only
 * in the request URL to api.adzuna.com and are never logged.
 *
 * Graceful degradation: without both credentials, discovery is simply "not
 * configured" — the UI explains what to activate, nothing errors.
 *
 * HONESTY: API fields are mapped only when present; everything else stays
 * null/unknown for the extractor + gate + score to treat honestly. The raw
 * response of each ad is snapshotted verbatim (same immutable-snapshot
 * guarantee as pasted imports).
 */

const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs";
const TIMEOUT_MS = 15_000;
const RESULTS_PER_PAGE = 10;

const resultSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  redirect_url: z.string().nullish(),
  company: z.object({ display_name: z.string().nullish() }).nullish(),
  location: z.object({ display_name: z.string().nullish() }).nullish(),
  contract_type: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  // Adzuna serializes this inconsistently (number 0/1 or string "0"/"1").
  salary_is_predicted: z.union([z.string(), z.number()]).nullish(),
});

const searchResponseSchema = z.object({
  results: z.array(resultSchema).default([]),
});

/** A discovered ad, mapped honestly (null = the source did not say). Shared
 *  by every legal discovery source (Adzuna, France Travail, Remotive, …). */
export type DiscoveredAd = {
  title: string | null;
  organization: string | null;
  description: string | null;
  locationText: string | null;
  sourceUrl: string | null;
  /** The engagement the source EXPLICITLY states, else null — the domain
   *  vocabulary, so a source that distinguishes freelance/part-time is not
   *  flattened into an approximation. */
  engagementType: "freelance" | "part_time" | "interim" | "permanent" | null;
  /** Salary bounds when Adzuna states them (ANNUAL figures), else null. */
  compensationMin: number | null;
  compensationMax: number | null;
  /** EUR only for the fr market — other markets stay honestly unknown. */
  compensationCurrency: "EUR" | null;
  /** Adzuna salaries are annual; set only when a figure exists. */
  compensationPeriod: "year" | null;
  /** The verbatim ad text snapshotted as the immutable source. */
  rawText: string;
};

export class AdzunaError extends Error {}

const log = createLogger({ module: "discovery-adzuna" });

export function adzunaConfigured(): boolean {
  return Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
}

function mapEngagement(
  contractType: string | null | undefined,
): DiscoveredAd["engagementType"] {
  if (contractType === "permanent") return "permanent";
  if (contractType === "contract") return "interim";
  return null; // unknown/unstated — never guessed
}

function toAd(r: z.infer<typeof resultSchema>): DiscoveredAd {
  const title = r.title?.trim() || null;
  const organization = r.company?.display_name?.trim() || null;
  const locationText = r.location?.display_name?.trim() || null;
  const description = r.description?.trim() || null;
  const rawText = [
    title,
    organization ? `chez ${organization}` : null,
    locationText ? `Location: ${locationText}` : null,
    "",
    description,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")
    .slice(0, 100_000);
  // A PREDICTED salary is Adzuna's model estimate, not something the ad
  // states — importing it as stated compensation would fabricate a claim
  // (honesty rule: null = the source did not say). Whole block dropped.
  const predicted =
    r.salary_is_predicted === "1" || r.salary_is_predicted === 1;
  let min =
    !predicted && typeof r.salary_min === "number"
      ? Math.round(r.salary_min)
      : null;
  let max =
    !predicted && typeof r.salary_max === "number"
      ? Math.round(r.salary_max)
      : null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const hasSalary = min !== null || max !== null;
  const redirect = r.redirect_url?.trim() || null;
  return {
    title,
    organization,
    description,
    locationText,
    // Only an http(s) URL is kept as provenance (defense in depth — it is
    // rendered as plain text, never a live link, but a javascript: value has
    // no business being stored either).
    sourceUrl: redirect && /^https?:\/\//i.test(redirect) ? redirect : null,
    engagementType: mapEngagement(r.contract_type),
    compensationMin: min,
    compensationMax: max,
    compensationCurrency:
      hasSalary && env.ADZUNA_COUNTRY === "fr" ? "EUR" : null,
    compensationPeriod: hasSalary ? "year" : null,
    rawText,
  };
}

/**
 * Search Adzuna for ads matching the given keywords. Throws `AdzunaError`
 * on config/HTTP/shape problems (callers surface an honest generic failure).
 *
 * Modes: "any" (default) ORs the keywords across the whole ad — right for a
 * mixed role+skills bag; "title" requires the words in the AD TITLE — right
 * for a target MÉTIER ("Data Engineer" must be the job, not two stray words
 * in a paragraph).
 */
export async function searchAdzuna(
  keywords: string[],
  mode: "any" | "title" = "any",
): Promise<DiscoveredAd[]> {
  if (!adzunaConfigured()) {
    throw new AdzunaError("adzuna credentials are not configured");
  }
  const what = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!what) throw new AdzunaError("no keywords to search");

  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID!,
    app_key: env.ADZUNA_APP_KEY!,
    ...(mode === "title" ? { title_only: what } : { what_or: what }),
    results_per_page: String(RESULTS_PER_PAGE),
    "content-type": "application/json",
  });
  const url = `${ADZUNA_BASE}/${env.ADZUNA_COUNTRY}/search/1?${params}`;

  let body: unknown;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Status only — the URL carries the credentials and is never logged.
      log.warn("adzuna request failed", { httpStatus: response.status });
      throw new AdzunaError(`adzuna request failed (${response.status})`);
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof AdzunaError) throw error;
    log.warn("adzuna request errored", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new AdzunaError("adzuna request errored");
  }

  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("adzuna response failed validation", {});
    throw new AdzunaError("adzuna response failed validation");
  }
  // Cap defensively at the requested page size, whatever the server returns.
  return parsed.data.results
    .slice(0, RESULTS_PER_PAGE)
    .map(toAd)
    .filter((ad) => ad.rawText.trim() !== "");
}
