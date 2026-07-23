import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, listOpportunities } from "@/lib/opportunity/logic";
import { loadPreferences } from "@/lib/profile/logic";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
} from "@/lib/matching/hard-constraints";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { GateBadge } from "@/components/matching/gate-badge";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Opportunités" };

/**
 * Opportunity ingestion home: paste-import a listing, then inspect the
 * owned opportunities. Server-rendered from the database (RLS: own rows).
 */
export default async function OpportunitiesPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [opportunities, preferences] = await Promise.all([
    listOpportunities(client, profile.id),
    loadPreferences(client, profile.id),
  ]);
  const copy = t().opportunities;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      <ImportForm />

      <section aria-label={copy.title} className="flex flex-col gap-3">
        {opportunities.length === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.listEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {opportunities.map((o) => (
              <li key={o.id}>
                <article className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">
                        {o.title ?? copy.none}
                      </h2>
                      <GateBadge
                        gate={
                          evaluateHardConstraints(
                            preferences,
                            opportunityFactsFromRow(o),
                          ).gate
                        }
                      />
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/opportunities/${o.id}`}>
                        {copy.openDetail}
                      </Link>
                    </Button>
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
    </div>
  );
}
