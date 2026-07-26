/**
 * The Recruitee tenants this deployment queries.
 *
 * WHY A CHECKED-IN LIST AND NOT A DISCOVERY CALL. Recruitee publishes no
 * directory of its customers — there is no "list all tenants" endpoint. The
 * subdomain has to be known in advance, and that, not pagination, is the real
 * integration constraint. Roughly 2 500 slugs are obtainable offline by unioning
 * the Common Crawl URL index with a permissively-licensed community list
 * (see docs/opportunity-sources.md), but nobody can be made to wait for 2 500
 * HTTP calls on a page load.
 *
 * So the list is CURATED, BOUNDED, and versioned with the code:
 *
 * - **Bounded** because a visit has a latency budget. A source that makes the
 *   product slow is a source that gets switched off.
 * - **Curated offline** because the two checks that protect an employer —
 *   reading their `robots.txt` and honouring the exclusion list — belong to a
 *   deliberate review, not to a request path that would double every call.
 * - **Versioned** because "which employers do we query" is a decision someone
 *   should be able to read in a diff, and object to.
 *
 * THIS LIST IS THE SECOND THING MISSIONPILOT KEEPS, after the profile. It is a
 * list of EMPLOYERS, not of offers: no listing is stored, every query is live,
 * every link is outbound. The "we store no offer" invariant holds — but the
 * exception is real and is stated rather than glossed over.
 */

/**
 * Tenants an employer asked us to stop querying, or whose `robots.txt` says
 * `Disallow: /`.
 *
 * Recruitee's own support article prescribes this channel verbatim: an employer
 * who does not want their listings relayed is told to "contact them directly
 * and ask if they can be taken offline". A product that offers no such door
 * makes that instruction impossible to follow, so this list exists before it is
 * needed — an exclusion mechanism added after the first complaint is a
 * mechanism that arrived late.
 */
export const EXCLUDED_TENANTS: readonly string[] = [
  // Refused in their own robots.txt (`Disallow: /`) during the curation pass of
  // 2026-07-26. Listed rather than merely omitted: a slug that silently
  // disappears gets re-added by the next person who runs the script.
  "1x",
  "aaff",
  "bakkergoedhartbroodspecialiteiten",
];

/**
 * The queried tenants.
 *
 * Kept deliberately short for a first iteration: enough to prove European
 * coverage, few enough that a visit stays fast. Growing it is an offline
 * curation task with its own checks, not a matter of pasting more slugs.
 */
export const RECRUITEE_TENANTS: readonly string[] = [
  // Curated 2026-07-26 by scripts/curate-recruitee-tenants.ts over the first
  // 160 candidates of a permissively-licensed community list (MIT). Each one
  // was checked in this order: robots.txt first — so a refusal is honoured
  // before we ask anything — then liveness, then "does it currently post in
  // Europe", which is the entire reason this source exists.
  //
  // 39 kept out of 160. Three refused. The rest were dead, empty, or posting
  // only outside Europe.
  "deintraumjobwartet", // 154 offres — AT,CH,DE,IT,SI,HU,CZ,SK
  "60secondstonapoli", // 104 offres — DE,AT,CH,IT
  "bauhausnederlandcv", // 47 offres — NL
  "alewijnse", // 42 offres — VN,NL,RO,FR
  "bernardgruppe", // 32 offres — DE,AT,IN
  "amiparis", // 30 offres — FR,IT,US,GB
  "apoint", // 27 offres — NL
  "abriogmbh", // 25 offres — DE
  "aidigital", // 25 offres — GE,US,CA,RS,CY,CO,IN
  "bnlaltradservices", // 25 offres — NL
  "arcus", // 18 offres — DE
  "biscuitinternational", // 17 offres — DE
  "12build", // 16 offres — NL,BE,DK,DE
  "aubay", // 14 offres — LU,FR
  "bwgfoods", // 14 offres — IE
  "bettercollective", // 14 offres — RS,US,DK,GB,BR
  "bcngroup", // 12 offres — GB,IE
  "azumuta", // 12 offres — FR,BE,NL
  "agaseurope", // 10 offres — GB,DE,NL
  "amfbakerysystemseurope", // 9 offres — NL
  "auditdata", // 9 offres — PL,UA,US,AU
  "avantarte", // 9 offres — NL,GB
  "by433", // 6 offres — NL
  "biqh", // 6 offres — NL
  "enersee", // 6 offres — BE
  "aceofperformance", // 5 offres — PT
  "bakerstreet", // 5 offres — DE
  "brpsteuernrecht", // 5 offres — DE
  "biovian", // 4 offres — FI
  "amcjobs", // 4 offres — BE
  "bloem", // 4 offres — NL
  "beckerbetzinstitute", // 4 offres — DE
  "benqeuropebv", // 4 offres — IT,NL
  "berlinmetropolitanschool", // 4 offres — DE
  "balogisticsgmbh", // 3 offres — DE
  "baobabinsurancegmbh", // 3 offres — DE
  "bcpartners", // 2 offres — GB
  "aihr", // 1 offres — NL
  "arcenergie", // 1 offres — DE
];

/** The tenants actually queried: the curated list minus every opt-out. */
export function activeTenants(
  tenants: readonly string[] = RECRUITEE_TENANTS,
  excluded: readonly string[] = EXCLUDED_TENANTS,
): string[] {
  const out = new Set(excluded.map((t) => t.trim().toLowerCase()));
  const seen = new Set<string>();
  const active: string[] = [];
  for (const raw of tenants) {
    const tenant = raw.trim().toLowerCase();
    // A slug becomes a hostname. Anything that is not a plain label could
    // redirect the request to another host entirely, so it is dropped rather
    // than escaped — there is no legitimate reason for one to appear here.
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenant)) continue;
    if (out.has(tenant) || seen.has(tenant)) continue;
    seen.add(tenant);
    active.push(tenant);
  }
  return active;
}
