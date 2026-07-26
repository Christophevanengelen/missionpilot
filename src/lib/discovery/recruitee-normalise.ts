import { z } from "zod";
import type { DiscoveredAd } from "./adzuna";
import { boundedAmount } from "./amount";
import { firstPlainText } from "./html-text";
import { toPostedAt } from "./posted-at";

/**
 * Turning a Recruitee offer into the product's own shape — PURE, and separate
 * from the fetching on purpose.
 *
 * Everything subtle about this source lives here: a body split across three
 * HTML fields, salaries sent as strings, a timestamp that is not ISO-8601, and
 * an employment vocabulary documented nowhere. Keeping it free of `server-only`
 * means it can be exercised against a REAL payload from a plain script, which
 * is how its traps were found in the first place — a mapping that can only be
 * checked by deploying is a mapping nobody checks.
 */

const salarySchema = z
  .object({
    // Recruitee sends these as JSON STRINGS ("3600"), not numbers.
    min: z.unknown().optional(),
    max: z.unknown().optional(),
    currency: z.string().nullish(),
    period: z.string().nullish(),
  })
  .nullish();

export const offerSchema = z.object({
  id: z.unknown().optional(),
  title: z.string().nullish(),
  company_name: z.string().nullish(),
  // There is NO single description field. The body of the ad lives mostly in
  // `requirements`; mapping `description` alone truncates a real posting to
  // roughly a tenth of its text.
  highlight: z.string().nullish(),
  description: z.string().nullish(),
  requirements: z.string().nullish(),
  location: z.string().nullish(),
  country_code: z.string().nullish(),
  careers_url: z.string().nullish(),
  employment_type_code: z.string().nullish(),
  salary: salarySchema,
  published_at: z.string().nullish(),
});

const SUPPORTED_CURRENCIES = new Set(["EUR", "USD", "GBP", "CHF"]);

/**
 * Their employment vocabulary, mapped ONLY where the meaning is certain.
 *
 * `fulltime_fixed_term` is deliberately NOT mapped to `interim`: a fixed-term
 * contract and agency work are legally distinct, and someone filtering for
 * interim work would be shown posts they cannot take. `internship` has no
 * counterpart in the domain vocabulary either. The enum is documented nowhere
 * for this endpoint, so anything unseen returns null and is logged.
 */
function mapEngagement(code: string | null | undefined): {
  engagementType: DiscoveredAd["engagementType"];
  unknown: string | null;
} {
  const value = code?.trim().toLowerCase() ?? "";
  switch (value) {
    case "":
      return { engagementType: null, unknown: null };
    case "fulltime_permanent":
      return { engagementType: "permanent", unknown: null };
    case "fulltime_fixed_term":
    case "internship":
      // Known, and knowingly left null — see above.
      return { engagementType: null, unknown: null };
    default:
      return { engagementType: null, unknown: value };
  }
}

/** Their period vocabulary, mapped only on values actually observed. */
function mapPeriod(
  period: string | null | undefined,
): "year" | "month" | "hour" | null {
  switch (period?.trim().toLowerCase()) {
    case "year":
      return "year";
    case "month":
      return "month";
    case "hour":
      return "hour";
    default:
      return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `published_at` arrives as "2026-07-16 10:39:05 UTC" — a space instead of the
 * `T`, a literal ` UTC` suffix, no `Z`. The timezone is stated explicitly, so
 * normalising it is a transcription and not an inference.
 *
 * Deliberately NOT `created_at` (internal creation, earlier) nor `updated_at`
 * (last edit, later): only `published_at` is the freshness signal a job seeker
 * reads, and the other two would make a stale ad look fresh.
 */
export function normaliseRecruiteeDate(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(UTC|Z)?$/,
  );
  if (match === null) return null;
  return `${match[1]}T${match[2]}Z`;
}

export function toAd(offer: z.infer<typeof offerSchema>): {
  ad: DiscoveredAd;
  unknownEngagement: string | null;
} {
  const title = offer.title?.trim() || null;
  const organization = offer.company_name?.trim() || null;

  // All three body fields, cleaned and joined: `requirements` usually carries
  // the substance, `description` the intro, `highlight` may be absent.
  const description =
    firstPlainText(
      [offer.highlight, offer.description, offer.requirements]
        .filter((p): p is string => typeof p === "string" && p.trim() !== "")
        .join("\n\n"),
    ) || null;

  const locationText = offer.location?.trim() || null;

  // Only their own absolute careers URL is trusted as provenance, and never
  // the apply URL: an "apply" link presented as the posting would send someone
  // straight into a form they never asked for.
  const rawUrl = offer.careers_url?.trim() ?? "";
  let sourceUrl: string | null = null;
  if (rawUrl !== "") {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "https:") sourceUrl = parsed.toString();
    } catch {
      sourceUrl = null;
    }
  }

  const { engagementType, unknown } = mapEngagement(offer.employment_type_code);

  // `salary` is ALWAYS an object, with its four sub-keys null when the employer
  // stated nothing — so presence of the object proves nothing and only the
  // bounds decide. A currency or a period without an amount is dropped whole:
  // half a salary is worse than none.
  const min = boundedAmount(toNumber(offer.salary?.min));
  const max = boundedAmount(toNumber(offer.salary?.max));
  const currencyRaw = offer.salary?.currency?.trim().toUpperCase() ?? "";
  const currency = SUPPORTED_CURRENCIES.has(currencyRaw)
    ? (currencyRaw as NonNullable<DiscoveredAd["compensationCurrency"]>)
    : null;
  const period = mapPeriod(offer.salary?.period);
  const hasPay =
    (min !== null || max !== null) && currency !== null && period !== null;

  const rawText = [
    title,
    organization,
    locationText,
    description,
    // The provenance belongs in the immutable snapshot: an ad we cannot trace
    // back later is an ad we cannot honestly show.
    sourceUrl,
  ]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join("\n\n");

  return {
    ad: {
      title,
      organization,
      description,
      locationText,
      sourceUrl,
      engagementType,
      compensationMin: hasPay ? min : null,
      compensationMax: hasPay ? max : null,
      compensationCurrency: hasPay ? currency : null,
      compensationPeriod: hasPay ? period : null,
      postedAt: toPostedAt(normaliseRecruiteeDate(offer.published_at)),
      rawText,
    },
    unknownEngagement: unknown,
  };
}
