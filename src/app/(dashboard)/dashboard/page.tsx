import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, listOpportunities } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { loadInsights } from "@/lib/matching/insight-logic";
import { summarizeOnboarding } from "@/lib/profile/onboarding";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { CvImport } from "../profile/cv-import";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard's two faces (owner fluidity mandate). First login — nothing
 * confirmed yet — is a CV hero that leads straight into the "upload → results"
 * flow (the CvImport screens auto-chain discovery + AI insights). Once a role
 * or a skill is confirmed, it becomes a status view: profile at a glance, how
 * many offers were found and analyzed, and the way through to them.
 */
export default async function DashboardPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [living, opportunities, insights, preferences] = await Promise.all([
    loadLivingProfile(client, profile.id),
    listOpportunities(client, profile.id),
    loadInsights(client, profile.id),
    loadPreferences(client, profile.id),
  ]);

  const summary = summarizeOnboarding(
    living.claims,
    opportunities.length,
    insights.size,
    preferences.targetRoleFamilies,
  );
  const copy = t().dashboard;

  if (!summary.hasProfile) {
    return (
      <section
        aria-labelledby="dashboard-title"
        className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      >
        <header className="flex flex-col gap-2">
          <h1 id="dashboard-title" className="text-2xl font-semibold">
            {copy.hero.title}
          </h1>
          <p className="text-muted-foreground text-sm">{copy.hero.lead}</p>
          <p className="text-muted-foreground text-xs">{copy.hero.privacy}</p>
        </header>
        <CvImport />
      </section>
    );
  }

  const status = copy.status;
  return (
    <section
      aria-labelledby="dashboard-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <h1 id="dashboard-title" className="text-2xl font-semibold">
        {status.title}
      </h1>

      <dl className="grid gap-3 sm:grid-cols-2">
        <StatCard label={status.roleLabel}>
          <span className="text-base font-semibold">
            {summary.roleTitle ?? (
              <span className="text-muted-foreground font-normal">
                {status.roleMissing}
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {status.skillsLabel(summary.confirmedSkills)}
          </span>
        </StatCard>

        <StatCard label={status.targetsLabel}>
          <span className="text-sm">
            {summary.targetRoles.length > 0 ? (
              summary.targetRoles.join(" · ")
            ) : (
              <span className="text-muted-foreground">
                {status.targetsMissing}
              </span>
            )}
          </span>
        </StatCard>

        <StatCard label={status.offersLabel(summary.opportunities)}>
          <span className="text-muted-foreground text-xs">
            {status.analyzedLabel(summary.analyzed)}
          </span>
        </StatCard>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        {summary.opportunities > 0 ? (
          <Button asChild size="sm">
            <Link href="/opportunities">{status.seeOffers}</Link>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">{status.noOffersHint}</p>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">{status.refreshCta}</Link>
        </Button>
      </div>
    </section>
  );
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  );
}
