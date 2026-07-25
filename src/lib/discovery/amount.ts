import "server-only";

/**
 * The bounds `opportunities.compensation_min/max` accepts (see the Phase 2
 * migration). Mirrored here so a source can drop an implausible figure BEFORE
 * it reaches the domain schema.
 */
const MAX_STORED_AMOUNT = 100_000_000;

/**
 * A salary figure fit to store, or null.
 *
 * Without this, an out-of-range number (negative, `Infinity` — which
 * `JSON.parse('{"n":1e400}')` produces — or above the column ceiling) travels
 * to `normalizedOpportunitySchema`, which throws and takes the WHOLE ad down
 * with it via per-ad isolation. Losing an entire offer because one field was
 * absurd is the wrong trade: drop the figure, keep the offer, and let the
 * field read honestly as "the source did not say".
 */
export function boundedAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > MAX_STORED_AMOUNT) return null;
  return rounded;
}
