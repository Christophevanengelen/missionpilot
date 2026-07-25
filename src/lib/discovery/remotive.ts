import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { toPlainText } from "./html-text";

/**
 * Remotive connector — a legal remote/freelance feed that fills the gap
 * Adzuna and France Travail leave (both are employee/on-site oriented, thin on
 * remote missions). Remotive publishes a PUBLIC JSON API; no scraping.
 *
 * ToS-DRIVEN CONSTRAINTS (deliberate, see the research findings):
 * - Attribution + link-back to the original posting: we keep `sourceUrl` as
 *   the provenance and record the source name on every imported opportunity.
 * - Polling limits: Remotive asks for a handful of calls per day. Discovery is
 *   user-triggered and rare, and one run issues at most one call per target
 *   métier — well inside that budget. There is NO background polling.
 * - Their listings must not be re-published to third-party job boards. We only
 *   ever surface them inside the user's OWN private inbox.
 *
 * Opt-in: inert unless REMOTIVE_ENABLED is set, so the deployment explicitly
 * accepts those terms rather than inheriting them silently.
 */

const SEARCH_URL = "https://remotive.com/api/remote-jobs";
const TIMEOUT_MS = 15_000;
const RESULTS_PER_PAGE = 10;

const jobSchema = z.object({
  title: z.string().nullish(),
  company_name: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  job_type: z.string().nullish(),
  description: z.string().nullish(),
  url: z.string().nullish(),
});

const responseSchema = z.object({ jobs: z.array(jobSchema).default([]) });

export class RemotiveError extends Error {}

const log = createLogger({ module: "discovery-remotive" });

export function remotiveConfigured(): boolean {
  return env.REMOTIVE_ENABLED === true;
}

function toAd(j: z.infer<typeof jobSchema>): DiscoveredAd {
  const title = j.title?.trim() || null;
  const organization = j.company_name?.trim() || null;
  const locationText = j.candidate_required_location?.trim() || null;
  const description = j.description ? toPlainText(j.description) : null;
  const jobType = j.job_type?.trim().toLowerCase() ?? "";
  const url = j.url?.trim() || null;
  const rawText = [
    title,
    organization ? `chez ${organization}` : null,
    locationText ? `Lieu : ${locationText} (télétravail)` : "Télétravail",
    jobType ? `Type : ${jobType}` : null,
    "",
    description,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")
    .slice(0, 100_000);
  return {
    title,
    organization,
    description,
    locationText,
    // Attribution: the link back to the original posting is required by ToS
    // and is the provenance we display.
    sourceUrl: url && /^https?:\/\//i.test(url) ? url : null,
    // Honest mapping of Remotive's job_type vocabulary; anything else stays
    // null rather than being guessed.
    engagementType:
      jobType === "full_time"
        ? "permanent"
        : jobType === "freelance"
          ? "freelance"
          : jobType === "contract"
            ? "interim"
            : jobType === "part_time"
              ? "part_time"
              : null,
    // Remotive salary is free text when present — never parsed into a figure.
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    rawText,
  };
}

/**
 * Search Remotive for remote roles matching the keywords. Throws
 * `RemotiveError` on config/HTTP/shape problems (the caller isolates it).
 */
export async function searchRemotive(
  keywords: string[],
): Promise<DiscoveredAd[]> {
  if (!remotiveConfigured()) {
    throw new RemotiveError("remotive source is not enabled");
  }
  const search = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!search) throw new RemotiveError("no keywords to search");

  const params = new URLSearchParams({
    search,
    limit: String(RESULTS_PER_PAGE),
  });
  let body: unknown;
  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      log.warn("remotive request failed", { httpStatus: response.status });
      throw new RemotiveError(`remotive request failed (${response.status})`);
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof RemotiveError) throw error;
    log.warn("remotive request errored", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new RemotiveError("remotive request errored");
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("remotive response failed validation", {});
    throw new RemotiveError("remotive response failed validation");
  }
  return (
    parsed.data.jobs
      .slice(0, RESULTS_PER_PAGE)
      .map(toAd)
      // ToS: attribution + link-back is REQUIRED, so an ad we cannot link back
      // to is dropped rather than imported without its provenance. Also drops
      // records with no readable content (nothing to snapshot honestly).
      .filter((ad) => ad.sourceUrl !== null && ad.title !== null)
      .filter((ad) => ad.rawText.trim() !== "")
  );
}
