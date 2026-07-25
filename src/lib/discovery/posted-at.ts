import "server-only";

/**
 * Publication dates, normalized to ISO-8601 UTC — or null.
 *
 * Freshness is the single most important signal a job seeker reads: nothing
 * destroys trust in a search engine faster than applying to a listing that has
 * been dead for three months. So this is worth getting exactly right, and the
 * sources make that harder than it looks — three of them state the same fact
 * three different ways:
 *
 *   Himalayas  pubDate: 1785001469              (Unix SECONDS)
 *   Jobicy     pubDate: "2026-07-25T11:30:03+00:00"  (ISO, with offset)
 *   Remotive   publication_date: "2026-07-24T10:33:35" (ISO, NO offset)
 *
 * Guessing a format is how a date lands months off, so each shape is handled
 * explicitly and anything unrecognised returns null — "the source did not say"
 * rather than a fabricated timestamp.
 *
 * The naive form is read as UTC. That is an assumption, and it is stated here
 * rather than hidden: it can be off by at most a few hours, which is invisible
 * at the "posted 2 days ago" granularity the UI shows, and no source in the
 * set documents a different zone.
 */

/** Below this, a number is seconds; above, milliseconds. Chosen well away from
 *  both plausible ranges: 10^11 s is year 5138, 10^11 ms is 1973. */
const MS_THRESHOLD = 100_000_000_000;
/** A little slack for clock skew — a listing may legitimately be stamped a few
 *  hours ahead. Beyond a day it is a parsing error, not a scheduled posting. */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
/** Older than this and the value is almost certainly a unit mix-up, not a real
 *  posting we want to date-stamp. */
const MAX_AGE_MS = 5 * 365 * 24 * 60 * 60 * 1000;

/** True when an ISO-ish string carries no zone, so it must be read as UTC. */
function lacksZone(value: string): boolean {
  return !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

/**
 * Format reading ONLY — no plausibility judgement.
 *
 * Kept separate because the two callers need different windows: a publication
 * date must be recent to be believable, while an EXPIRY is legitimately in the
 * future and may be far out. Folding both into one function was a real bug:
 * passing `Infinity` as the reference time made `now - MAX_AGE` infinite too,
 * so every expiry parsed to null and no listing was ever seen as expired.
 */
function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < MS_THRESHOLD ? value * 1000 : value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // A bare integer in a string field is still a Unix stamp.
  if (/^\d+$/.test(trimmed)) return parseTimestamp(Number(trimmed));
  const ms = Date.parse(lacksZone(trimmed) ? `${trimmed}Z` : trimmed);
  return Number.isFinite(ms) ? ms : null;
}

export function toPostedAt(
  value: unknown,
  now: number = Date.now(),
): string | null {
  const ms = parseTimestamp(value);
  if (ms === null) return null;
  if (ms > now + MAX_FUTURE_MS) return null;
  if (ms < now - MAX_AGE_MS) return null;
  return new Date(ms).toISOString();
}

/**
 * True when a listing states an expiry that has passed.
 *
 * An expired offer has no business in a view of what is open RIGHT NOW — and
 * only Himalayas states one, so this is a bonus where available, never an
 * assumption elsewhere. Unparseable or absent expiry means "not expired",
 * because we do not know that it is.
 */
export function isExpired(value: unknown, now: number = Date.now()): boolean {
  const ms = parseTimestamp(value);
  if (ms === null) return false;
  return ms < now;
}
