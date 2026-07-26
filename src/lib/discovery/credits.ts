/**
 * The credits a source contractually requires when its data is displayed.
 *
 * Per-result attribution — a named source and a link back on each card — is
 * already handled. Several sources ask for something else on top: a visible
 * credit for the SET of results, naming them and linking to their site. Adzuna
 * is the strict one ("Jobs by Adzuna", with "Jobs" hyperlinked); Remote OK
 * makes a dofollow link and a named mention a condition of continued access.
 *
 * Two design rules:
 *
 * 1. **Driven by what is actually on screen.** A credit is owed for data
 *    displayed, so it is computed from the sources that really produced the
 *    visible results — never from what happens to be configured. Crediting a
 *    source that returned nothing would be a false statement about where these
 *    offers came from, which is the same honesty rule the whole product runs
 *    on, pointed at ourselves.
 * 2. **Unknown sources get no credit line.** Silence is the safe default: an
 *    invented obligation is noise, and a missing one is caught by the registry
 *    review rather than guessed at here.
 *
 * NOT SETTLED, and deliberately not papered over: Adzuna's clause specifies an
 * IMAGE badge of at least 116×23px, and their free tier is non-commercial.
 * This renders the required wording and link, which is strictly better than
 * the nothing that was there before — but the image badge and the tier
 * question are the owner's calls, and they are recorded as open in
 * docs/opportunity-sources.md.
 */

export type SourceCredit = {
  source: string;
  /** Text before the link. */
  prefix: string;
  /** The linked words — Adzuna requires "Jobs" specifically. */
  linkText: string;
  href: string;
  /** Text after the link. */
  suffix: string;
};

const CREDITS: Record<string, Omit<SourceCredit, "source">> = {
  Adzuna: {
    prefix: "",
    linkText: "Jobs",
    href: "https://www.adzuna.co.uk",
    suffix: " by Adzuna",
  },
  "Remote OK": {
    prefix: "Offres à distance par ",
    linkText: "Remote OK",
    href: "https://remoteok.com",
    suffix: "",
  },
  Jobicy: {
    prefix: "Offres à distance par ",
    linkText: "Jobicy",
    href: "https://jobicy.com",
    suffix: "",
  },
  Himalayas: {
    prefix: "Offres à distance par ",
    linkText: "Himalayas",
    href: "https://himalayas.app",
    suffix: "",
  },
  Remotive: {
    prefix: "Offres à distance par ",
    linkText: "Remotive",
    href: "https://remotive.com",
    suffix: "",
  },
};

/**
 * The credits owed for a set of displayed results, de-duplicated and in a
 * stable order so the block does not reshuffle between renders.
 */
export function creditsFor(
  sourceNames: readonly (string | null)[],
): SourceCredit[] {
  const seen = new Set<string>();
  const credits: SourceCredit[] = [];
  for (const name of sourceNames) {
    if (name === null) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const credit = CREDITS[name];
    if (credit === undefined) continue;
    credits.push({ source: name, ...credit });
  }
  return credits.sort((a, b) => a.source.localeCompare(b.source));
}
