/**
 * Whether a stored provenance URL may be rendered as a LIVE link.
 *
 * Two legitimate rules collide here, and this module is where they are
 * reconciled rather than one silently winning:
 *
 * 1. SAFETY (pre-existing, guarded by an e2e test): a provenance URL is
 *    untrusted external content — for a pasted import it is whatever the user
 *    typed, for an imported ad it is whatever a remote API returned. Turning
 *    arbitrary untrusted input into a clickable link is a phishing surface, so
 *    the product's rule has always been "provenance is shown, never live".
 *
 * 2. ATTRIBUTION (contractual): Himalayas, Jobicy, Remotive and Adzuna all
 *    require credit WITH A LINK BACK to the posting. A URL printed as inert
 *    text does not satisfy "credited with a direct link to the source".
 *
 * The reconciliation: a link is offered ONLY when the URL demonstrably belongs
 * to the source that supplied it — a known source name AND a host inside that
 * source's own domain. Everything else (pasted imports, unknown sources, a
 * source pointing somewhere unexpected) keeps the old inert-text behaviour.
 * So the obligation is met exactly where it applies, and the attack surface it
 * would otherwise open stays closed.
 *
 * Failure mode is deliberate: anything we are not sure about renders as text.
 */

/** Each legal source's own domains. Suffix-matched, so `www.` and regional
 *  hosts are covered; a lookalike like `adzuna.fr.evil.com` is NOT, because
 *  matching is anchored to the end of the host. */
const SOURCE_DOMAINS: Record<string, readonly string[]> = {
  Adzuna: [
    "adzuna.fr",
    "adzuna.com",
    "adzuna.co.uk",
    "adzuna.be",
    "adzuna.de",
    "adzuna.nl",
  ],
  "France Travail": ["francetravail.fr"],
  Remotive: ["remotive.com"],
  Himalayas: ["himalayas.app"],
  Jobicy: ["jobicy.com"],
  "Remote OK": ["remoteok.com"],
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * The URL to render as a live attribution link, or null to render the
 * provenance as plain text.
 */
export function attributionLink(
  sourceName: string | null,
  sourceUrl: string | null,
): string | null {
  if (!sourceName || !sourceUrl) return null;
  const domains = SOURCE_DOMAINS[sourceName];
  if (!domains) return null;
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  // http(s) only — a stored `javascript:` or `data:` value must never become
  // an href, whatever else is true about it.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return domains.some((d) => hostMatches(parsed.hostname.toLowerCase(), d))
    ? sourceUrl
    : null;
}
