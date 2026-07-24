import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import {
  countSnapshots,
  getLatestSnapshot,
  getOpportunity,
  getOwnProfile,
} from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
} from "@/lib/matching/hard-constraints";
import { profileSignalsFromClaims, scoreMatch } from "@/lib/matching/score";
import { NORMALIZED_FIELDS } from "@/domain/opportunity";
import { t } from "@/lib/copy";
import { CardField } from "@/components/cards/card-shell";
import { GateBadge } from "@/components/matching/gate-badge";

export const metadata: Metadata = { title: "Opportunité" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Read-only inspection of one opportunity: the frozen source capture next to
 * the normalized fields, with an explicit UNVERIFIED banner and an honest
 * list of fields ingestion could not determine. Server-rendered (RLS).
 */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const { id } = await params;
  const client = await createClient();
  const copy = t().opportunities;

  // uuid guard: an invalid id can never reach the DB as a malformed query.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return <NotFound />;
  }

  const profile = await getOwnProfile(client);
  const [opportunity, snapshot, seenCount, preferences, living] =
    await Promise.all([
      getOpportunity(client, id),
      getLatestSnapshot(client, id),
      countSnapshots(client, id),
      loadPreferences(client, profile.id),
      loadLivingProfile(client, profile.id),
    ]);
  if (!opportunity) return <NotFound />;

  const facts = opportunityFactsFromRow(opportunity);
  const report = evaluateHardConstraints(preferences, facts);
  const score = scoreMatch(
    preferences,
    profileSignalsFromClaims(living.claims),
    facts,
  );
  const matchedSkills =
    score.components.find((c) => c.key === "skills")?.evidence ?? [];

  const remote = opportunity.remote_type
    ? copy.remoteTypes[opportunity.remote_type as keyof typeof copy.remoteTypes]
    : null;
  const engagement = opportunity.engagement_type
    ? copy.engagementTypes[
        opportunity.engagement_type as keyof typeof copy.engagementTypes
      ]
    : null;
  const comp = formatCompensation(opportunity);

  const singles: [string, string | null][] = [
    [copy.fields.organization, opportunity.organization],
    [copy.fields.engagementType, engagement],
    [copy.fields.seniority, opportunity.seniority],
    [copy.fields.remoteType, remote],
    [copy.fields.locationText, opportunity.location_text],
    [copy.fields.compensation, comp],
    [copy.fields.sourceUrl, opportunity.source_url],
  ];
  const lists: [string, string[]][] = [
    [copy.fields.requirements, (opportunity.requirements as string[]) ?? []],
    [
      copy.fields.responsibilities,
      (opportunity.responsibilities as string[]) ?? [],
    ],
    [copy.fields.skills, (opportunity.skills as string[]) ?? []],
  ];

  const unknowns = computeUnknowns(opportunity);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {opportunity.title ?? copy.none}
        </h1>
        <p className="text-muted-foreground text-xs">
          {copy.seenCount(seenCount)}
        </p>
        <p
          role="note"
          className="border-warning/40 bg-warning/10 text-foreground/80 rounded-lg border px-3 py-2 text-xs"
        >
          {copy.unverifiedBanner}
        </p>
      </header>

      <section
        aria-label={copy.hardConstraints.section}
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.hardConstraints.section}
          </h2>
          <GateBadge gate={report.gate} />
        </div>
        <p className="text-muted-foreground text-xs">
          {copy.hardConstraints.note}
        </p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {report.checks.map((c) => (
            <div
              key={c.key}
              className="flex items-baseline justify-between gap-2 border-b border-dashed py-1 last:border-0"
            >
              <dt className="text-muted-foreground text-xs">
                {copy.hardConstraints.checks[c.key]}
              </dt>
              <dd className="text-right text-xs">
                {copy.hardConstraints.verdicts[c.verdict]}
                {c.key === "hard_exclusions" &&
                c.verdict === "violated" &&
                c.detail ? (
                  <span className="text-foreground/80 block">
                    {copy.hardConstraints.excludedTerm(c.detail)}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-label={copy.matchScore.section}
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.matchScore.section}
          </h2>
          {score.overall !== null ? (
            <span className="text-lg font-semibold">
              {copy.matchScore.overall(score.overall)}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">{copy.matchScore.note}</p>
        {score.overall === null ? (
          <p className="text-muted-foreground text-sm">
            {copy.matchScore.none}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {copy.matchScore.confidenceLabel} :{" "}
              {copy.matchScore.confidence[score.confidence]}
            </p>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {score.components.map((c) => (
                <div
                  key={c.key}
                  className="flex items-baseline justify-between gap-2 border-b border-dashed py-1 last:border-0"
                >
                  <dt className="text-muted-foreground text-xs">
                    {copy.matchScore.components[c.key]}
                  </dt>
                  <dd className="text-xs">
                    {c.score !== null
                      ? copy.matchScore.overall(c.score)
                      : copy.matchScore.unscored}
                  </dd>
                </div>
              ))}
            </dl>
            {matchedSkills.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs">
                  {copy.matchScore.matchedSkills}
                </p>
                <ul className="flex flex-wrap gap-1">
                  {matchedSkills.map((s) => (
                    <li
                      key={s}
                      className="border-border bg-background rounded-full border px-2 py-0.5 text-xs"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section
        aria-label={copy.sections.normalized}
        className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.sections.normalized}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {singles.map(([label, value]) => (
            <CardField key={label} label={label}>
              {value ?? (
                <span className="text-muted-foreground">{copy.none}</span>
              )}
            </CardField>
          ))}
        </dl>
        {lists.map(([label, items]) =>
          items.length > 0 ? (
            <div key={label} className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">{label}</p>
              <ul className="list-inside list-disc text-sm">
                {items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        {opportunity.description ? (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-xs">
              {copy.fields.description}
            </p>
            <p className="text-sm whitespace-pre-line">
              {opportunity.description}
            </p>
          </div>
        ) : null}
      </section>

      {unknowns.length > 0 ? (
        <section
          aria-label={copy.sections.unknowns}
          className="flex flex-col gap-2"
        >
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.sections.unknowns}
          </h2>
          <p className="text-muted-foreground text-sm">
            {copy.unknownsNote(unknowns.length)}
          </p>
        </section>
      ) : null}

      {snapshot ? (
        <section
          aria-label={copy.sections.source}
          className="border-border bg-surface-raised flex flex-col gap-2 rounded-xl border p-4"
        >
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.sections.source}
          </h2>
          <p className="text-muted-foreground text-xs">
            {copy.capturedAt(
              dateFormatter.format(new Date(snapshot.retrieved_at)),
            )}
          </p>
          <pre className="bg-background max-h-96 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
            {snapshot.raw_text}
          </pre>
        </section>
      ) : null}

      <p>
        <Link
          href="/opportunities"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {copy.backToList}
        </Link>
      </p>
    </div>
  );
}

function formatCompensation(o: {
  compensation_min: number | null;
  compensation_max: number | null;
  compensation_currency: string | null;
  compensation_period: string | null;
}): string | null {
  if (o.compensation_min === null && o.compensation_max === null) return null;
  const range =
    o.compensation_min === o.compensation_max || o.compensation_max === null
      ? `${o.compensation_min}`
      : `${o.compensation_min}–${o.compensation_max}`;
  return [range, o.compensation_currency, o.compensation_period]
    .filter(Boolean)
    .join(" ");
}

function computeUnknowns(o: Record<string, unknown>): string[] {
  const snake: Record<(typeof NORMALIZED_FIELDS)[number], string> = {
    title: "title",
    organization: "organization",
    engagementType: "engagement_type",
    seniority: "seniority",
    description: "description",
    requirements: "requirements",
    responsibilities: "responsibilities",
    skills: "skills",
    locationText: "location_text",
    remoteType: "remote_type",
    compensationMin: "compensation_min",
    compensationMax: "compensation_max",
    compensationCurrency: "compensation_currency",
    compensationPeriod: "compensation_period",
    sourceName: "source_name",
    sourceUrl: "source_url",
  };
  return NORMALIZED_FIELDS.filter((f) => {
    const v = o[snake[f]];
    return v === null || (Array.isArray(v) && v.length === 0);
  });
}

function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {t().opportunities.notFound}
      </p>
      <p>
        <Link
          href="/opportunities"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t().opportunities.backToList}
        </Link>
      </p>
    </div>
  );
}
