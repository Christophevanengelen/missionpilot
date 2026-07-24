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
import { aiInsightConfigured } from "@/lib/matching/ai-insight";
import { loadInsights, type StoredInsight } from "@/lib/matching/insight-logic";
import { adzunaConfigured } from "@/lib/discovery/adzuna";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { GateBadge } from "@/components/matching/gate-badge";
import { DiscoverButton } from "./discover-button";
import { ExplainButton } from "./explain-button";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Opportunités" };

const GATES: readonly EligibilityGate[] = ["eligible", "review", "excluded"];
const ENGAGEMENTS = ["freelance", "part_time", "interim", "permanent"] as const;
const REMOTES = ["remote_only", "hybrid", "onsite"] as const;

type Filters = {
  filter: EligibilityGate | null;
  type: (typeof ENGAGEMENTS)[number] | null;
  remote: (typeof REMOTES)[number] | null;
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const filter = pick(sp.filter);
  const type = pick(sp.type);
  const remote = pick(sp.remote);
  return {
    filter: GATES.includes(filter as EligibilityGate)
      ? (filter as Filters["filter"])
      : null,
    type: ENGAGEMENTS.includes(type as (typeof ENGAGEMENTS)[number])
      ? (type as Filters["type"])
      : null,
    remote: REMOTES.includes(remote as (typeof REMOTES)[number])
      ? (remote as Filters["remote"])
      : null,
  };
}

/** Href for the inbox with the given filters (nulls omitted) — every chip
 *  link PRESERVES the other active filter groups. */
function inboxHref(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.filter) params.set("filter", filters.filter);
  if (filters.type) params.set("type", filters.type);
  if (filters.remote) params.set("remote", filters.remote);
  const query = params.toString();
  return query ? `/opportunities?${query}` : "/opportunities";
}

/**
 * Opportunity inbox: paste-import a listing, then triage owned opportunities by
 * the deterministic hard-constraint gate (PR 1) and the match score (PR 3) —
 * best matches first within each gate — and filter by eligibility, contract
 * type and remote mode (owner request: "triables CDI/CDD/remote").
 * Server-rendered from the database (RLS: own rows); every filter is a plain
 * searchParam so it needs no client JS.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [opportunities, preferences, living, insights] = await Promise.all([
    listOpportunities(client, profile.id),
    loadPreferences(client, profile.id),
    loadLivingProfile(client, profile.id),
    loadInsights(client, profile.id),
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

  const active = parseFilters(await searchParams);
  // Rows passing the type/remote groups — the gate chips count over THESE, so
  // a chip's number always predicts exactly what clicking it will show
  // (honesty: never "Éligible (2)" leading to an empty state).
  const base = evaluated.filter(
    (e) =>
      (active.type === null || e.o.engagement_type === active.type) &&
      (active.remote === null || e.o.remote_type === active.remote),
  );
  const counts: Record<EligibilityGate, number> = {
    eligible: 0,
    review: 0,
    excluded: 0,
  };
  for (const e of base) counts[e.gate]++;
  const shown = base.filter(
    (e) => active.filter === null || e.gate === active.filter,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      {adzunaConfigured() ? (
        <DiscoverButton />
      ) : (
        <p className="text-muted-foreground text-xs">
          {copy.discover.unconfiguredNote}
        </p>
      )}

      {aiInsightConfigured() && opportunities.length > 0 ? (
        <ExplainButton />
      ) : null}

      <ImportForm />

      {opportunities.length === 0 ? (
        <p className="text-muted-foreground text-sm">{copy.listEmpty}</p>
      ) : (
        <section aria-label={copy.title} className="flex flex-col gap-3">
          <nav
            aria-label={copy.inbox.filterLabel}
            className="flex flex-col gap-2"
          >
            <div
              role="group"
              className="flex flex-wrap gap-2"
              aria-label={copy.inbox.gateLabel}
            >
              <FilterChip
                href={inboxHref({ ...active, filter: null })}
                label={`${copy.inbox.all} (${base.length})`}
                active={active.filter === null}
              />
              {GATES.map((g) => (
                <FilterChip
                  key={g}
                  href={inboxHref({ ...active, filter: g })}
                  label={`${copy.gate[g]} (${counts[g]})`}
                  active={active.filter === g}
                />
              ))}
            </div>
            <div
              role="group"
              className="flex flex-wrap gap-2"
              aria-label={copy.inbox.typeLabel}
            >
              <FilterChip
                href={inboxHref({ ...active, type: null })}
                label={copy.inbox.allTypes}
                active={active.type === null}
              />
              {ENGAGEMENTS.map((e) => (
                <FilterChip
                  key={e}
                  href={inboxHref({ ...active, type: e })}
                  label={copy.engagementTypes[e]}
                  active={active.type === e}
                />
              ))}
            </div>
            <div
              role="group"
              className="flex flex-wrap gap-2"
              aria-label={copy.inbox.remoteLabel}
            >
              <FilterChip
                href={inboxHref({ ...active, remote: null })}
                label={copy.inbox.allRemotes}
                active={active.remote === null}
              />
              {REMOTES.map((r) => (
                <FilterChip
                  key={r}
                  href={inboxHref({ ...active, remote: r })}
                  label={copy.remoteTypes[r]}
                  active={active.remote === r}
                />
              ))}
            </div>
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
                    data-insight={insights.has(o.id) ? "true" : undefined}
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
                    <InsightBlock
                      insight={insights.get(o.id)}
                      copy={copy.insight}
                    />
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

/** The AI "pourquoi ce match" summary on a card — a PROPOSAL layered on top
 *  of the deterministic gate + score, with the model's own uncertainty shown
 *  when present. Renders nothing when the offer has no live insight. */
function InsightBlock({
  insight,
  copy,
}: {
  insight: StoredInsight | undefined;
  copy: ReturnType<typeof t>["opportunities"]["insight"];
}) {
  if (!insight) return null;
  return (
    <div className="border-border mt-1 flex flex-col gap-1 border-t pt-2">
      <p className="text-xs font-medium">
        {copy.whyTitle} · {copy.fit[insight.fit] ?? insight.fit}
      </p>
      <p className="text-muted-foreground text-xs">{insight.rationale}</p>
      {insight.needs_review ? (
        <p role="note" className="text-muted-foreground text-xs italic">
          {copy.needsReview}
        </p>
      ) : null}
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
