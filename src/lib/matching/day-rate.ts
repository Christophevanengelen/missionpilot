/**
 * Freelance day-rate (TJM) benchmark from a legally-sourced ANNUAL salary
 * (Phase 6 P3 — deterministic, no AI). A senior freelancer's unmet need is
 * pricing themselves; job listings state employee salaries, not day rates, so
 * we convert transparently — and ONLY when the ad actually states a salary
 * (predicted/estimated salaries were already dropped upstream, so this never
 * fabricates a figure from a guess).
 *
 * Method (fully disclosed to the user, not a black box):
 *   day-rate ≈ annual gross ÷ BILLABLE_DAYS × freelance uplift.
 * BILLABLE_DAYS is the French "forfait jours" standard; the uplift band covers
 * what a freelancer carries that an employee does not (social charges, paid
 * leave, inter-contract gaps, risk). The result is a rounded BALLPARK range —
 * an estimate to refine, never a guarantee (honesty: it is derived, labelled,
 * and null whenever the inputs don't support it).
 */

/** Standard French billable days per year (forfait jours). */
export const BILLABLE_DAYS = 218;
/** Disclosed rule-of-thumb uplift band for a freelance vs. an employee. */
export const FREELANCE_UPLIFT_LOW = 1.5;
export const FREELANCE_UPLIFT_HIGH = 2;

export type DayRateEstimate = {
  low: number;
  high: number;
  currency: string;
};

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Estimate a freelance day-rate range, or `null` when the compensation cannot
 * support one honestly (not an ANNUAL figure, no currency, or no bound).
 */
export function estimateDayRate(comp: {
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: string | null;
  compensationPeriod: string | null;
}): DayRateEstimate | null {
  if (comp.compensationPeriod !== "year") return null;
  if (!comp.compensationCurrency) return null;

  const min = comp.compensationMin;
  const max = comp.compensationMax;
  // Use whichever bound(s) exist; a single stated figure anchors both ends.
  const annualLow = min ?? max;
  const annualHigh = max ?? min;
  if (annualLow === null || annualHigh === null) return null;
  if (annualLow <= 0 || annualHigh <= 0) return null;

  let low = roundTo10((annualLow / BILLABLE_DAYS) * FREELANCE_UPLIFT_LOW);
  let high = roundTo10((annualHigh / BILLABLE_DAYS) * FREELANCE_UPLIFT_HIGH);
  if (low > high) [low, high] = [high, low];

  return { low, high, currency: comp.compensationCurrency };
}
