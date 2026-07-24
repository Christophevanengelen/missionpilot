import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import {
  dueFollowUps,
  groupByStage,
  listTracked,
  TRACKING_STAGES,
  type TrackedOpportunity,
} from "@/lib/tracking/logic";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Suivi des candidatures" };

/**
 * The application-tracking board: opportunities the user is actively pursuing,
 * grouped into pipeline columns, with the due follow-ups surfaced on top.
 * Server-rendered from the user's own tracking rows (RLS). Deterministic, no
 * AI, private — the mission-tracking layer for a senior freelancer.
 */
export default async function ApplicationsPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const tracked = await listTracked(client, profile.id);
  const copy = t().applications;
  const stageLabels = t().opportunities.tracking.stages;

  const groups = groupByStage(tracked);
  // "Today" in the app's target timezone (not UTC) so a follow-up dated for the
  // user's LOCAL day surfaces from local midnight, not only once UTC rolls over.
  // en-CA renders ISO YYYY-MM-DD, matching dueFollowUps' lexical comparison.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Paris",
  });
  const due = dueFollowUps(tracked, today);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      {tracked.length === 0 ? (
        <p className="text-muted-foreground text-sm">{copy.empty}</p>
      ) : (
        <>
          {due.length > 0 ? (
            <section
              aria-label={copy.followUpsTitle}
              className="border-warning/40 bg-warning/10 flex flex-col gap-2 rounded-xl border p-4"
            >
              <h2 className="text-xs font-medium tracking-wide uppercase">
                {copy.followUpsTitle}
              </h2>
              <ul className="flex flex-col gap-1">
                {due.map((item) => (
                  <li key={item.opportunityId} className="text-sm">
                    <Link
                      href={`/opportunities/${item.opportunityId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {item.title ?? copy.untitled}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {copy.followUpDue(item.followUpOn ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRACKING_STAGES.map((stage) => (
              <section
                key={stage}
                aria-label={stageLabels[stage]}
                className="flex flex-col gap-2"
              >
                <h2 className="text-muted-foreground flex items-baseline justify-between text-xs font-medium tracking-wide uppercase">
                  <span>{stageLabels[stage]}</span>
                  <span className="tabular-nums">{groups[stage].length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {groups[stage].map((item) => (
                    <li key={item.opportunityId}>
                      <TrackedCard item={item} openLabel={copy.open} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrackedCard({
  item,
  openLabel,
}: {
  item: TrackedOpportunity;
  openLabel: string;
}) {
  return (
    <article className="border-border bg-card flex flex-col gap-1 rounded-xl border p-3">
      <p className="truncate text-sm font-medium">{item.title ?? "—"}</p>
      {item.organization ? (
        <p className="text-muted-foreground truncate text-xs">
          {item.organization}
        </p>
      ) : null}
      {item.note ? (
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {item.note}
        </p>
      ) : null}
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/opportunities/${item.opportunityId}`}>{openLabel}</Link>
        </Button>
      </div>
    </article>
  );
}
