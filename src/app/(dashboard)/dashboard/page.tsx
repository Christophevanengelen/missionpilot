import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, listOpportunities } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { loadInsights } from "@/lib/matching/insight-logic";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { buildPositioning, type Positioning } from "@/lib/matching/positioning";
import {
  summarizeOnboarding,
  type OnboardingSummary,
} from "@/lib/profile/onboarding";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { CvImport } from "../profile/cv-import";
import { DashboardHome } from "./dashboard-home";

export const metadata: Metadata = { title: "Dashboard" };

type DashboardCopy = ReturnType<typeof t>["dashboard"];

/**
 * The dashboard's two faces (owner fluidity mandate). First login — nothing
 * confirmed yet — is a CV hero that leads straight into the "upload → results"
 * flow (the CvImport screens auto-chain discovery + AI insights). Once a role
 * or a skill is confirmed, it becomes a status view: profile at a glance, how
 * many offers were found and analyzed, and the way through to them.
 *
 * The choice is latched client-side (see DashboardHome) so the mid-flow
 * refresh the CV import fires never yanks a first-login user out of the hero.
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
  // Market positioning from the user's OWN corpus (deterministic, null when
  // there is not enough of it to say anything honestly).
  const positioning = buildPositioning(
    opportunities.map((o) => ({ skills: (o.skills as string[]) ?? null })),
    profileSignalsFromClaims(living.claims).skills,
  );

  return (
    <DashboardHome
      initialHasProfile={summary.hasProfile}
      hero={<Hero copy={copy} />}
      status={
        <StatusView summary={summary} copy={copy} positioning={positioning} />
      }
    />
  );
}

function Hero({ copy }: { copy: DashboardCopy }) {
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

function StatusView({
  summary,
  copy,
  positioning,
}: {
  summary: OnboardingSummary;
  copy: DashboardCopy;
  positioning: Positioning | null;
}) {
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
          <span className="text-base font-semibold break-words">
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
          <span className="text-sm break-words">
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
          {summary.opportunities > 0 ? (
            <span className="text-muted-foreground text-xs">
              {status.analyzedLabel(summary.analyzed)}
            </span>
          ) : null}
        </StatCard>
      </dl>

      {positioning ? (
        <section
          aria-label={copy.positioning.title}
          className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {copy.positioning.title}
            </h2>
            <span className="text-sm font-semibold tabular-nums">
              {copy.positioning.coverage(positioning.coverage)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            {copy.positioning.note(positioning.corpusSize)}
          </p>
          <ul className="flex flex-wrap gap-2">
            {positioning.topSkills.map((s) => (
              <li key={s.label}>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    s.covered
                      ? "border-success/50 bg-success/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {s.label} · {s.share}%
                  <span className="sr-only">
                    {" "}
                    {s.covered
                      ? copy.positioning.covered
                      : copy.positioning.missing}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
    <div className="border-border bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  );
}
