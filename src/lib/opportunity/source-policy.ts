/**
 * Source-policy gate for URL imports (Phase 2). Pure and framework-free.
 *
 * Owner decision: this PR does NOT fetch third-party content server-side. The
 * gate only CLASSIFIES a submitted URL and records the decision as
 * provenance; the user still pastes the listing text. That keeps us clear of
 * SSRF and of scraping sites whose terms forbid it. Real, guarded fetching of
 * an approved allowlist is a separate, explicitly-approved PR.
 *
 * Even though nothing is fetched here, the classifier already rejects
 * private/internal hosts and bare IPs — good hygiene and the exact guard the
 * future fetch PR will rely on.
 */

export type SourceBlockedReason =
  "invalid_url" | "unsupported_scheme" | "private_host" | "terms_forbid";

/** Discriminated on `decision`: a `blocked` result always carries a blocked
 *  reason; an accepted one carries "ok". `manual_only` = public http(s) URL
 *  accepted as provenance (user pastes the text); `allowed` is reserved for
 *  the future guarded-fetch PR. */
export type SourceClassification =
  | { decision: "manual_only" | "allowed"; host: string | null; reason: "ok" }
  | { decision: "blocked"; host: string | null; reason: SourceBlockedReason };

/** Domains whose terms of service forbid scraping/importing their listings.
 *  Blocked as an import SOURCE — the user may still paste text via the plain
 *  paste flow, which makes no claim about the origin. */
const TERMS_BLOCKLIST = new Set([
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
]);

/** Hostnames that must never be treated as a public source (SSRF hygiene) —
 *  the exact guard the future fetch PR will rely on. Rejects loopback/private
 *  names and ALL IP-literal hosts (a source is a named site, never a raw
 *  address). */
function isPrivateHost(host: string): boolean {
  // Normalise a trailing dot ("localhost." resolves to loopback all the same).
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  // ANY IPv6 literal (WHATWG keeps the brackets). Blocking every bracketed
  // literal in one rule covers loopback, ULA, link-local, unspecified,
  // IPv4-mapped (`[::ffff:169.254.169.254]`) and public IPv6 — no bypass.
  if (h.startsWith("[")) {
    return true;
  }
  // IPv4 literal, dotted form (WHATWG canonicalises decimal/octal/hex to it).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return true;
  }
  return false;
}

function registrableRoot(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
}

/** Classify a submitted source URL. Never throws. */
export function classifySource(rawUrl: string): SourceClassification {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { decision: "blocked", host: null, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      decision: "blocked",
      host: parsed.hostname || null,
      reason: "unsupported_scheme",
    };
  }
  const host = parsed.hostname;
  if (!host || isPrivateHost(host)) {
    return { decision: "blocked", host: host || null, reason: "private_host" };
  }
  const root = registrableRoot(host);
  if (TERMS_BLOCKLIST.has(root)) {
    return { decision: "blocked", host, reason: "terms_forbid" };
  }
  return { decision: "manual_only", host, reason: "ok" };
}
