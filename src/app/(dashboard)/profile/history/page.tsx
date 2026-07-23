import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import {
  getOwnProfile,
  getVersionByNumber,
  listVersions,
} from "@/lib/profile/logic";
import { diffVersions } from "@/lib/profile/version-diff";
import type { VersionContent } from "@/lib/profile/version-content";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { VersionSnapshot } from "./version-snapshot";
import { CompareResult } from "./compare-result";
import { ComparePicker } from "./compare-picker";
import { RestoreVersion } from "./restore-version";

export const metadata: Metadata = { title: "Historique du profil" };

/**
 * Read-only history of the confirmed profile versions. Server-rendered from
 * the database (RLS: own rows only); version identity in URLs is the HUMAN
 * version number, always resolved server-side against the caller's own
 * profile — never a technical id in the interface.
 */

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function parseVersionParam(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : null;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const versions = await listVersions(client, profile.id);
  const copy = t().history;
  const params = await searchParams;

  const numberById = new Map(versions.map((v) => [v.id, v.version_number]));
  const latestNumber = versions[0]?.version_number ?? null;
  const numbers = versions.map((v) => v.version_number);

  const from = parseVersionParam(params.from);
  const to = parseVersionParam(params.to);
  const single = parseVersionParam(params.version);

  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
    </header>
  );

  // ---- comparison mode ----------------------------------------------------
  if (from !== null && to !== null) {
    if (from === to) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {header}
          {numbers.length >= 2 ? (
            <ComparePicker numbers={numbers} from={from} to={to} />
          ) : null}
          <p className="text-muted-foreground text-sm">
            {copy.compare.sameVersion}
          </p>
          <BackLinks />
        </div>
      );
    }
    const [before, after] = await Promise.all([
      getVersionByNumber(client, profile.id, from),
      getVersionByNumber(client, profile.id, to),
    ]);
    if (!before || !after) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {header}
          <p className="text-muted-foreground text-sm">
            {copy.versionUnavailable}
          </p>
          <BackLinks />
        </div>
      );
    }
    const diff = diffVersions(
      before.content as VersionContent,
      after.content as VersionContent,
    );
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {header}
        <ComparePicker numbers={numbers} from={from} to={to} />
        <CompareResult from={from} to={to} diff={diff} />
        <BackLinks />
      </div>
    );
  }

  // ---- single-version mode ------------------------------------------------
  if (single !== null) {
    const version = await getVersionByNumber(client, profile.id, single);
    if (!version) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {header}
          <p className="text-muted-foreground text-sm">
            {copy.versionUnavailable}
          </p>
          <BackLinks />
        </div>
      );
    }
    const restoredFrom = version.created_from_version_id
      ? (numberById.get(version.created_from_version_id) ?? null)
      : null;
    const compareHref =
      numbers.length >= 2
        ? version.version_number === latestNumber
          ? `/profile/history?from=${numbers[1]}&to=${latestNumber}`
          : `/profile/history?from=${version.version_number}&to=${latestNumber}`
        : null;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {header}
        <section
          aria-label={copy.versionLabel(version.version_number)}
          className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {copy.versionLabel(version.version_number)}
            </h2>
            {version.version_number === latestNumber ? (
              <Badge>{copy.latestBadge}</Badge>
            ) : null}
            {restoredFrom !== null ? (
              <Badge>{copy.restoredFrom(restoredFrom)}</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            {copy.confirmedOn(
              dateFormatter.format(new Date(version.published_at)),
            )}
          </p>
          <p className="text-sm">
            {version.change_summary?.trim() ? (
              <span className="italic">« {version.change_summary} »</span>
            ) : (
              <span className="text-muted-foreground">{copy.noSummary}</span>
            )}
          </p>
          <p className="border-border text-muted-foreground border-t pt-3 text-xs">
            {copy.readOnlyNotice}
          </p>
          <VersionSnapshot content={version.content as VersionContent} />
          <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
            {compareHref ? (
              <Button asChild variant="outline" size="sm">
                <Link href={compareHref}>{t().actions.compare}</Link>
              </Button>
            ) : null}
            <RestoreVersion
              versionId={version.id}
              versionNumber={version.version_number}
            />
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">{copy.backToProfile}</Link>
            </Button>
          </div>
        </section>
        <p>
          <Link
            href="/profile/history"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {copy.backToHistory}
          </Link>
        </p>
      </div>
    );
  }

  // ---- list mode ----------------------------------------------------------
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {header}
      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{copy.empty}</p>
      ) : (
        <>
          {versions.length >= 2 ? (
            <p className="text-sm">
              <Link
                href={`/profile/history?from=${numbers[1]}&to=${numbers[0]}`}
                className="underline-offset-4 hover:underline"
              >
                {t().actions.compare} :{" "}
                {copy.compare.direction(numbers[1], numbers[0])}
              </Link>
            </p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {versions.map((v) => {
              const restoredFrom = v.created_from_version_id
                ? (numberById.get(v.created_from_version_id) ?? null)
                : null;
              return (
                <li key={v.id}>
                  <article
                    aria-label={copy.versionLabel(v.version_number)}
                    className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">
                        {copy.versionLabel(v.version_number)}
                      </h2>
                      {v.version_number === latestNumber ? (
                        <Badge>{copy.latestBadge}</Badge>
                      ) : null}
                      {restoredFrom !== null ? (
                        <Badge>{copy.restoredFrom(restoredFrom)}</Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {copy.confirmedOn(
                        dateFormatter.format(new Date(v.published_at)),
                      )}
                    </p>
                    <p className="text-sm">
                      {v.change_summary?.trim() ? (
                        <span className="italic">« {v.change_summary} »</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {copy.noSummary}
                        </span>
                      )}
                    </p>
                    <div>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/profile/history?version=${v.version_number}`}
                        >
                          {copy.openVersion}
                        </Link>
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <BackLinks />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-surface-raised text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}

function BackLinks() {
  const copy = t().history;
  return (
    <p>
      <Link
        href="/profile"
        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        {copy.backToProfile}
      </Link>
    </p>
  );
}
