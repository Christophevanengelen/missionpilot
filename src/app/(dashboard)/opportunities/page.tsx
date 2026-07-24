import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, listOpportunities } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
  type EligibilityGate,
} from "@/lib/matching/hard-constraints";
import { profileSignalsFromClaims, scoreMatch } from "@/lib/matching/score";
import { compareRanked } from "@/lib/matching/rank";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { GateBadge } from "@/components/matching/gate-badge";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Opportunités" };

const GATES: readonly EligibilityGate[] = ["eligible", "review", "excluded"];

/**
 * Opportunity inbox: paste-import a listing, then triage owned opportunities by
 * the deterministic hard-constraint gate (PR 1) and the match score (PR 3) —
 * best matches first within each gate. Server-rendered from the database (RLS:
 * own rows); the eligibility filter is a plain searchParam so it needs no
 * client JS.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [opportunities, preferences, living] = await Promise.all([
    listOpportunities(client, profile.id),
    loadPreferences(client, profile.id),
    loadLivingProfile(client, profile.id),
  ]);
  const copy = t().opportunities;
  const signals = profileSignalsFromClaims(living.claims);

  const evaluated = opportunities
    .map((o) => {
      const facts = opportunityFactsFromRow(o);
      return {
        o,
        gate: evaluateHardConstraints(preferences, facts).gate,
        score: scoreMatch(preferences, signals, facts).overall,
      };
    })
    // Seeded by last_seen_at desc from the query; compareRanked is a stable
    // gate-then-score sort, so ties keep recency order.
    .sort(compareRanked);

  const counts: Record<EligibilityGate, number> = {
    eligible: 0,
    review: 0,
    excluded: 0,
  };
  for (const e of evaluated) counts[e.gate]++;

  const sp = await searchParams;
  const filterParam = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const activeFilter = GATES.includes(filterParam as EligibilityGate)
    ? (filterParam as EligibilityGate)
    : null;
  const shown = activeFilter
    ? evaluated.filter((e) => e.gate === activeFilter)
    : evaluated;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      <ImportForm />

      {opportunities.length === 0 ? (
        <p className="text-muted-foreground text-sm">{copy.listEmpty}</p>
      ) : (
        <section aria-label={copy.title} className="flex flex-col gap-3">
          <nav
            aria-label={copy.inbox.filterLabel}
            className="flex flex-wrap gap-2"
          >
            <FilterChip
              href="/opportunities"
              label={`${copy.inbox.all} (${opportunities.length})`}
              active={activeFilter === null}
            />
            {GATES.map((g) => (
              <FilterChip
                key={g}
                href={`/opportunities?filter=${g}`}
                label={`${copy.gate[g]} (${counts[g]})`}
                active={activeFilter === g}
              />
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.inbox.empty}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {shown.map(({ o, gate, score }) => (
                <li key={o.id}>
                  <article
                    className={`border-border bg-card flex flex-col gap-1 rounded-xl border p-4 ${
                      gate === "excluded" ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm font-semibold">
                          {o.title ?? copy.none}
                        </h2>
                        <GateBadge gate={gate} />
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {score !== null ? (
                          <span
                            className="text-muted-foreground text-xs tabular-nums"
                            title={copy.matchScore.section}
                          >
                            {copy.matchScore.overall(score)}
                          </span>
                        ) : null}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/opportunities/${o.id}`}>
                            {copy.openDetail}
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {[
                        o.organization,
                        o.seniority,
                        o.engagement_type
                          ? copy.engagementTypes[
                              o.engagement_type as keyof typeof copy.engagementTypes
                            ]
                          : null,
                        o.remote_type
                          ? copy.remoteTypes[
                              o.remote_type as keyof typeof copy.remoteTypes
                            ]
                          : null,
                        o.location_text,
                      ]
                        .filter(Boolean)
                        .join(" · ") || copy.none}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
