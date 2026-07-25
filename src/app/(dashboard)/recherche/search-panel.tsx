"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";
import { searchMarketAction } from "@/lib/search/actions";
import {
  DEFAULT_SORT,
  NO_FILTERS,
  SORT_KEYS,
  engagementFacets,
  filterHits,
  remoteFacets,
  sortHits,
  unstatedCount,
  type MarketFilters,
  type MarketSort,
  type SortKey,
} from "@/lib/search/refine";
import type { MarketHit, MarketSearchResult } from "@/lib/search/types";
import type { EngagementType, RemoteType } from "@/domain/opportunity";

const ENGAGEMENTS: readonly EngagementType[] = [
  "freelance",
  "part_time",
  "interim",
  "permanent",
];
const REMOTES: readonly RemoteType[] = ["remote_only", "hybrid", "onsite"];

/**
 * The market search screen.
 *
 * The search itself is a server round trip; EVERY refinement afterwards —
 * filters, sorting — is computed here, in the browser, over the hits already
 * held in state. That is what makes narrowing a result list feel instant, and
 * it is why `refine.ts` is pure and free of `server-only`.
 */
export function SearchPanel({ defaultQuery }: { defaultQuery: string }) {
  const copy = t().search;
  const [query, setQuery] = useState(defaultQuery);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MarketSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketFilters>(NO_FILTERS);
  const [sort, setSort] = useState<MarketSort>(DEFAULT_SORT);
  const inFlightRef = useRef(false);

  const shown = useMemo(() => {
    if (result === null) return [];
    return sortHits(filterHits(result.hits, filters), sort);
  }, [result, filters, sort]);

  const unstated = useMemo(
    () => (result === null ? 0 : unstatedCount(shown, filters)),
    [result, shown, filters],
  );

  async function run() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const outcome = await searchMarketAction({ query });
      if (outcome.ok) {
        setResult(outcome.result);
      } else {
        setResult(null);
        setError(copy.errors[outcome.error]);
      }
    } catch {
      setResult(null);
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <Label htmlFor="market-query">{copy.queryLabel}</Label>
          <Input
            id="market-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.queryPlaceholder}
          />
        </div>
        <Button type="submit" aria-busy={busy || undefined}>
          {busy ? copy.searching : copy.submit}
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">{copy.queryHint}</p>

      {/* Live regions mounted up-front so a screen reader announces the result
          when the text changes, rather than when the node appears. */}
      <p role="status" className="text-sm">
        {result === null || busy
          ? ""
          : copy.resultCount(shown.length, result.hits.length)}
      </p>
      <p role="alert" className="text-destructive text-sm">
        {error ?? ""}
      </p>

      {result !== null ? (
        <>
          {result.failedSources.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {copy.partial(result.failedSources)}
            </p>
          ) : null}

          <section
            aria-label={copy.refineLabel}
            className="flex flex-col gap-3"
          >
            <ChipGroup
              label={copy.engagementLabel}
              options={engagementFacets(result.hits, filters, ENGAGEMENTS).map(
                (f) => ({
                  value: f.value,
                  label:
                    f.value === null
                      ? copy.notStated
                      : t().opportunities.engagementTypes[f.value],
                  count: f.count,
                }),
              )}
              selected={filters.engagementTypes}
              unstatedSelected={filters.includeUnstated}
              onToggle={(v) =>
                setFilters((f) =>
                  v === null
                    ? { ...f, includeUnstated: !f.includeUnstated }
                    : { ...f, engagementTypes: toggle(f.engagementTypes, v) },
                )
              }
            />
            <ChipGroup
              label={copy.remoteLabel}
              options={remoteFacets(result.hits, filters, REMOTES).map((f) => ({
                value: f.value,
                label:
                  f.value === null
                    ? copy.notStated
                    : t().opportunities.remoteTypes[f.value],
                count: f.count,
              }))}
              selected={filters.remoteTypes}
              unstatedSelected={filters.includeUnstated}
              onToggle={(v) =>
                setFilters((f) =>
                  v === null
                    ? { ...f, includeUnstated: !f.includeUnstated }
                    : { ...f, remoteTypes: toggle(f.remoteTypes, v) },
                )
              }
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="market-country">{copy.countryLabel}</Label>
              <Input
                id="market-country"
                placeholder={copy.countryPlaceholder}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    countries: e.target.value
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>

            {/* The honesty control. Most sources state very little, so the
                default KEEPS offers that said nothing — and says so. */}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.includeUnstated}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    includeUnstated: e.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                {copy.includeUnstated}
                <span className="text-muted-foreground block text-xs">
                  {copy.includeUnstatedNote}
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="market-sort">{copy.sortLabel}</Label>
                <select
                  id="market-sort"
                  className="border-border bg-background rounded-md border px-2 py-1.5 text-sm"
                  value={sort.key}
                  onChange={(e) =>
                    setSort((s) => ({ ...s, key: e.target.value as SortKey }))
                  }
                >
                  {SORT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {copy.sortKeys[k]}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSort((s) => ({
                    ...s,
                    direction: s.direction === "desc" ? "asc" : "desc",
                  }))
                }
              >
                {sort.direction === "desc" ? copy.sortDesc : copy.sortAsc}
              </Button>
            </div>

            {unstated > 0 ? (
              <p className="text-muted-foreground text-xs">
                {copy.unstatedNote(unstated)}
              </p>
            ) : null}
          </section>

          <ul className="flex flex-col gap-3">
            {shown.map((hit) => (
              <ResultRow key={hit.key} hit={hit} />
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.noneShown}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  unstatedSelected,
  onToggle,
}: {
  label: string;
  options: { value: T | null; label: string; count: number }[];
  selected: readonly T[];
  /** Whether the shared "not stated" setting is on — the null chip reflects
   *  it, so the same truth is visible wherever the user is looking. */
  unstatedSelected: boolean;
  onToggle: (value: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on =
            o.value === null ? unstatedSelected : selected.includes(o.value);
          return (
            <button
              key={o.value ?? "__unstated"}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={
                on
                  ? "border-foreground bg-foreground text-background rounded-full border px-3 py-1 text-xs"
                  : "border-border rounded-full border px-3 py-1 text-xs"
              }
            >
              {/* The count is what makes a three-state filter legible: the user
                  sees what checking the box will cost before clicking. */}
              {o.label} ({o.count})
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Whole days since publication, floored — the granularity the copy shows. */
function ageInDays(postedAt: string): number {
  return Math.floor((Date.now() - Date.parse(postedAt)) / 86_400_000);
}

function ResultRow({ hit }: { hit: MarketHit }) {
  const copy = t().search;
  const opp = t().opportunities;
  const meta = [
    hit.organization,
    hit.locationText,
    hit.engagementType ? opp.engagementTypes[hit.engagementType] : null,
    hit.remoteType ? opp.remoteTypes[hit.remoteType] : null,
  ].filter(Boolean);

  return (
    <li className="border-border flex flex-col gap-1 rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{hit.title ?? copy.untitled}</h2>
        {hit.score !== null ? (
          <span className="text-muted-foreground text-xs">
            {copy.scoreLabel(hit.score)}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {meta.join(" · ") || copy.noMeta}
      </p>
      {/* Freshness is the first thing a job seeker reads. When the source gave
          no date we SAY so, rather than passing off the moment we fetched it
          as the moment it was published — the commonest lie of aggregators. */}
      <p className="text-muted-foreground text-xs">
        {hit.postedAt === null
          ? copy.ageUnknown
          : copy.age(ageInDays(hit.postedAt))}
      </p>
      {hit.excerpt ? <p className="text-sm">{hit.excerpt}</p> : null}
      <p className="text-muted-foreground text-xs">
        {opp.fields.sourceName} : {hit.sourceName}
        {hit.sourceUrl ? (
          <>
            {" · "}
            {/* The whole promise of the product: this leads to the original
                posting, on the platform that published it. */}
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {copy.openOnSource}
            </a>
          </>
        ) : null}
        {/* Merged duplicates: being carried by several platforms is a signal
            the posting is live — and every one of them is owed its credit. */}
        {hit.sources.length > 1
          ? ` · ${copy.alsoOn(hit.sources.slice(1).map((s) => s.name))}`
          : ""}
      </p>
      {hit.unknowns.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {copy.unknownFields(hit.unknowns.length)}
        </p>
      ) : null}
    </li>
  );
}
