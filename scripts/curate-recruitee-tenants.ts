/**
 * Offline curation of the Recruitee tenant list.
 *
 * Recruitee publishes no directory of its customers, so the subdomains have to
 * be known in advance. This script turns a candidate list into a VALIDATED one,
 * and it runs offline — deliberately, because the two checks that protect an
 * employer belong to a deliberate review rather than to a request path that
 * would double every call a visitor makes.
 *
 * What it checks, per candidate:
 *
 * 1. **`robots.txt` first, always.** It is generated per tenant, which makes it
 *    the one machine-readable channel an employer has to say no. `Disallow: /`
 *    is treated as an opt-out: the tenant is reported and never queried. The
 *    check happens BEFORE the offers call, so a refusal is honoured rather than
 *    noticed afterwards.
 * 2. **Liveness.** A dead subdomain in the list costs every visitor a timeout.
 * 3. **Where the offers actually are.** A tenant is kept only if it currently
 *    posts in Europe — the whole point of this source is the local market the
 *    remote boards do not cover.
 *
 * Usage:
 *   pnpm exec tsx scripts/curate-recruitee-tenants.ts candidates.csv [limit]
 *
 * It prints a report and the validated slugs. Adding them to
 * src/lib/discovery/recruitee-tenants.ts stays a human edit: which employers we
 * query is a decision that should be readable in a diff, and objectionable.
 */

const OFFERS_URL = (t: string) => `https://${t}.recruitee.com/api/offers/`;
const ROBOTS_URL = (t: string) => `https://${t}.recruitee.com/robots.txt`;
const USER_AGENT =
  "MissionPilot/1.0 (open-source job search; +https://github.com/Christophevanengelen/missionpilot)";
const TIMEOUT_MS = 12_000;
/** Courtesy, not throughput. Nothing here is time-critical. */
const CONCURRENCY = 4;

const EUROPE = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

type Verdict =
  | { slug: string; keep: true; offers: number; countries: string[] }
  | { slug: string; keep: false; why: string };

async function get(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when the tenant's robots.txt refuses everything to a generic agent. */
function refusesAll(robots: string): boolean {
  let generic = false;
  for (const line of robots.split(/\r?\n/)) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") generic = value === "*";
    // Only a bare `Disallow: /` is an opt-out. `Disallow: /v/` — Recruitee's
    // own default — is not, and reading it as one would silently discard every
    // tenant that never expressed anything.
    if (generic && key === "disallow" && value === "/") return true;
  }
  return false;
}

async function check(slug: string): Promise<Verdict> {
  const robots = await get(ROBOTS_URL(slug));
  if (robots !== null && robots.ok && refusesAll(await robots.text())) {
    return { slug, keep: false, why: "robots.txt: opt-out (Disallow: /)" };
  }

  const response = await get(OFFERS_URL(slug));
  if (response === null) return { slug, keep: false, why: "injoignable" };
  if (!response.ok)
    return { slug, keep: false, why: `HTTP ${response.status}` };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { slug, keep: false, why: "réponse illisible" };
  }
  const offers = (payload as { offers?: unknown })?.offers;
  if (!Array.isArray(offers)) {
    return { slug, keep: false, why: "enveloppe inattendue" };
  }
  if (offers.length === 0) return { slug, keep: false, why: "aucune offre" };

  const countries = [
    ...new Set(
      offers
        .map((o) => (o as { country_code?: unknown }).country_code)
        .filter((c): c is string => typeof c === "string" && c !== "")
        .map((c) => c.toUpperCase()),
    ),
  ];
  if (!countries.some((c) => EUROPE.has(c))) {
    return {
      slug,
      keep: false,
      why: `hors Europe (${countries.join(",") || "aucun pays déclaré"})`,
    };
  }
  return { slug, keep: true, offers: offers.length, countries };
}

async function main() {
  const [file, rawLimit] = process.argv.slice(2);
  if (!file) {
    console.error(
      "usage: tsx scripts/curate-recruitee-tenants.ts <csv> [limit]",
    );
    process.exit(1);
  }
  const limit = Number(rawLimit ?? "200");
  const { readFileSync } = await import("node:fs");
  const rows = readFileSync(file, "utf8").split(/\r?\n/).slice(1);
  const candidates = rows
    .map((r) => r.split(",")[1]?.trim().toLowerCase() ?? "")
    .filter((s) => /^[a-z0-9][a-z0-9-]{0,62}$/.test(s))
    .slice(0, Number.isFinite(limit) ? limit : 200);

  console.error(`${candidates.length} candidats, concurrence ${CONCURRENCY}`);
  const verdicts: Verdict[] = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    verdicts.push(...(await Promise.all(batch.map(check))));
    console.error(
      `  ${Math.min(i + CONCURRENCY, candidates.length)}/${candidates.length}`,
    );
  }

  const kept = verdicts.filter(
    (v): v is Extract<Verdict, { keep: true }> => v.keep,
  );
  const optOuts = verdicts.filter((v) => !v.keep && v.why.startsWith("robots"));

  console.error(`\nretenus : ${kept.length} / ${verdicts.length}`);
  console.error(`opt-out robots.txt : ${optOuts.length}`);
  for (const v of optOuts) console.error(`  ! ${v.slug}`);

  console.log(
    kept
      .sort((a, b) => b.offers - a.offers)
      .map(
        (v) =>
          `  "${v.slug}", // ${v.offers} offres — ${v.countries.join(",")}`,
      )
      .join("\n"),
  );
}

void main();
