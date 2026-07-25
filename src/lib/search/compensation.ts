import { BILLABLE_DAYS, MAX_PLAUSIBLE_ANNUAL } from "@/lib/matching/day-rate";
import type { MarketHit } from "./types";

/**
 * Comparing pay across offers that state it in different units.
 *
 * This is the hole a benchmark of ten job boards found nobody filling, and it
 * matters most exactly here — for a senior freelance, listings arrive as an
 * annual salary from employee-oriented boards AND as a day rate from mission
 * boards. Sorting the raw figures puts 90 000 €/an above 900 €/jour, when the
 * second is worth roughly twice the first. A sort that wrong is not a feature,
 * it is a lie with arrows on it.
 *
 * TWO RULES KEEP THIS HONEST:
 *
 * 1. The conversion between PERIODS is arithmetic on a disclosed assumption —
 *    218 billable days a year, the French forfait-jours figure already used by
 *    the day-rate estimator, so the whole app assumes one thing, once. Every
 *    converted figure is flagged so the UI can say "≈" and name the assumption
 *    instead of presenting it as the offer's own words.
 *
 * 2. Currencies are NEVER converted. That would need a live exchange rate we
 *    do not have, and inventing one is precisely what this product refuses.
 *    A figure keeps its currency, the currency is always displayed, and the
 *    comparison across currencies is left visible rather than papered over.
 */

/** Billable hours in a day — the second assumption, kept separate so it can be
 *  read and argued with rather than buried in a magic number. */
const BILLABLE_HOURS_PER_DAY = 7;

export type AnnualEquivalent = {
  /** Annualised amount, in the offer's OWN currency. */
  amount: number;
  currency: string;
  /** False when the offer already stated an annual figure — true when we
   *  derived it, and the UI must say so. */
  converted: boolean;
};

/** The multiplier from a stated period to a year, or null when the period is
 *  not one we can annualise without guessing. */
function perYear(period: string | null): number | null {
  switch (period) {
    case "year":
      return 1;
    case "month":
      return 12;
    case "day":
      return BILLABLE_DAYS;
    case "hour":
      return BILLABLE_DAYS * BILLABLE_HOURS_PER_DAY;
    default:
      return null;
  }
}

/**
 * One comparable number per offer, or null.
 *
 * The UPPER bound is annualised when present — it is what a reader compares on
 * — falling back to the lower bound so a single-figure offer still ranks.
 * Beyond the plausibility ceiling the result is dropped: an annual equivalent
 * of several million almost always means a mis-extracted figure, and ranking
 * an offer at the top of the list on a parsing bug is worse than not ranking
 * it at all.
 */
export function annualEquivalent(hit: {
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: string | null;
  compensationPeriod: string | null;
}): AnnualEquivalent | null {
  const factor = perYear(hit.compensationPeriod);
  if (factor === null) return null;
  if (hit.compensationCurrency === null) return null;
  const stated = hit.compensationMax ?? hit.compensationMin;
  if (stated === null) return null;
  const amount = Math.round(stated * factor);
  if (amount <= 0 || amount > MAX_PLAUSIBLE_ANNUAL) return null;
  return {
    amount,
    currency: hit.compensationCurrency,
    converted: hit.compensationPeriod !== "year",
  };
}

/** Sort value: the annualised amount, or null so the offer sinks to the
 *  bottom like every other unstated field. */
export function comparablePay(hit: MarketHit): number | null {
  return annualEquivalent(hit)?.amount ?? null;
}
