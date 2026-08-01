"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";
import { searchMarketAction } from "@/lib/search/actions";
import { PasPourMoi } from "./pas-pour-moi";
import {
  AGE_WINDOWS,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
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
import { annualEquivalent, payParts } from "@/lib/search/compensation";
import { buildStaircase } from "@/lib/search/staircase";
import { creditsFor } from "@/lib/discovery/credits";
import type { MarketHit, MarketSearchResult } from "@/lib/search/types";
import type { EngagementType, RemoteType } from "@/domain/opportunity";
import { MAX_COUNTRIES_PER_SEARCH, SEARCH_COUNTRIES } from "@/domain/countries";

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
export function SearchPanel({
  defaultQuery,
  defaultCountries,
  initialResult = null,
  stepUpTitles = [],
  searchedTitles = [],
  openingOutcome = "ok",
  trajectory = null,
}: {
  defaultQuery: string;
  defaultCountries: string[];
  /** Title phrasings that mark an offer as the step up. */
  stepUpTitles?: string[];
  /** Les intitulés sous lesquels la recherche d'ouverture a réellement été
   *  lancée. Les plateformes ne formulent pas les métiers comme un CV, et
   *  quelqu'un qui ne voit pas ce qu'on a cherché pour lui ne peut pas savoir
   *  si la liste est vide parce que le marché est vide, ou parce qu'on a
   *  cherché à côté. */
  searchedTitles?: string[];
  /** Ce qu'a donné la recherche lancée à l'ouverture. Le silence était le pire
   *  état possible : la personne lisait « cherché à l'instant » au-dessus d'un
   *  vide, sans savoir si le produit avait cherché, échoué, ou si le marché
   *  n'avait rien. */
  openingOutcome?: "ok" | "no_plan" | "error";
  /** The career reading behind the staircase, or null when unavailable. */
  trajectory?: {
    currentLevel: string;
    nextLevel: string | null;
    readiness: "ready" | "close" | "not_yet" | "unknown";
    evidence: string[];
    missing: string[];
    questions: string[];
    rationale: string;
  } | null;
  /** Results already computed on the server for this visit. The product does
   *  not ask the user to search: what the market has for them today is on
   *  screen when they arrive, and the box below only REFINES it. */
  initialResult?: MarketSearchResult | null;
}) {
  const copy = t().search;
  const [query, setQuery] = useState(defaultQuery);
  const [countries, setCountries] = useState<string[]>(defaultCountries);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MarketSearchResult | null>(
    initialResult,
  );
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<MarketSort>(DEFAULT_SORT);
  const inFlightRef = useRef(false);
  /** Une recherche manuelle a-t-elle eu lieu ? Dès lors, c'est elle qui parle,
   *  et le diagnostic d'ouverture doit se taire. */
  const [touched, setTouched] = useState(false);
  /** Le repli d'affinage devient contrôlé : le diagnostic d'ouverture doit
   *  pouvoir l'ouvrir, sans casser le clic sur le résumé. */
  const [refineOpen, setRefineOpen] = useState(false);
  const queryRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    if (result === null) return [];
    return sortHits(filterHits(result.hits, filters), sort);
  }, [result, filters, sort]);

  const unstated = useMemo(
    () => (result === null ? 0 : unstatedCount(shown, filters)),
    [result, shown, filters],
  );

  async function run() {
    setTouched(true);
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const outcome = await searchMarketAction({ query, countries });
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
      {/* RESULTS FIRST. The user connects to see opportunities — every control
          placed above them is a toll booth on the way to the only thing they
          came for. Refinement lives below, folded away, for the visit where
          they actually want it. */}
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

      {/* L'ouverture n'a rien donné, et on le DIT. Le `!touched` est la garde
          qui compte : dès que la personne a lancé une recherche à la main,
          c'est le message d'erreur de CETTE recherche qui fait foi, et
          afficher les deux en même temps serait pire que le silence. */}
      {result === null && !busy && !touched && openingOutcome !== "ok" ? (
        <div className="border-border flex flex-col items-start gap-3 rounded-xl border p-4">
          <p className="text-sm text-pretty">
            {openingOutcome === "no_plan"
              ? copy.openingNoPlan
              : copy.openingFailed}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setRefineOpen(true);
              if (openingOutcome === "no_plan") {
                // Pas de tir à l'aveugle : sans métier renseigné la requête
                // serait vide et reviendrait avec « aucun mot-clé ». On ouvre
                // et on met le curseur là où la personne doit écrire.
                queryRef.current?.focus();
              } else {
                void run();
              }
            }}
          >
            {openingOutcome === "no_plan"
              ? copy.openingNoPlanAction
              : copy.openingFailedAction}
          </Button>
        </div>
      ) : null}

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
            {/* Freshness first: it is the signal a job seeker reads before any
                other, and the default window is what keeps a two-year-old ad
                from leading a view of what is open NOW. */}
            <div
              role="group"
              aria-label={copy.ageLabel}
              className="flex flex-col gap-1"
            >
              <span className="text-muted-foreground text-xs">
                {copy.ageLabel}
              </span>
              <div className="flex flex-wrap gap-2">
                {[...AGE_WINDOWS, null].map((days) => {
                  const on = filters.maxAgeDays === days;
                  return (
                    <button
                      key={days ?? "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFilters((f) => ({ ...f, maxAgeDays: days }))
                      }
                      className={
                        on
                          ? "border-foreground bg-foreground text-background rounded-full border px-3 py-1 text-xs"
                          : "border-border rounded-full border px-3 py-1 text-xs"
                      }
                    >
                      {days === null ? copy.ageAll : copy.ageWindow(days)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="market-country">{copy.placeFilterLabel}</Label>
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

          {/* LES PREUVES, ET ELLES VIENNENT AVANT L'ESCALIER.
              C'est la promesse entière du produit : « le poste d'un cran
              au-dessus, avec les preuves tirées de votre propre parcours ».
              Elle était calculée par l'IA, transmise jusqu'ici… et jamais
              affichée. La bande servait une phrase générique, identique pour
              tout le monde — c'est-à-dire l'instant exact où quelqu'un se dit
              qu'il a affaire à un agrégateur de plus.

              Placé AVANT `buildStaircase` et non sous le titre de la bande :
              sous la bande, ce bloc disparaîtrait les jours où aucune offre du
              marché ne correspond à la marche d'après — c'est-à-dire
              précisément les jours où savoir pourquoi on est prêt compte le
              plus. Ce qu'on a compris d'un parcours ne dépend pas de ce que le
              marché publie ce matin. */}
          {trajectory !== null && trajectory.evidence.length > 0 ? (
            <section className="border-rise/40 bg-rise/[0.05] flex flex-col gap-2 rounded-xl border border-l-2 p-4">
              {trajectory.nextLevel !== null ? (
                <h2 className="font-medium tracking-tight text-balance">
                  {copy.trajectoryTitle(
                    trajectory.currentLevel,
                    trajectory.nextLevel,
                  )}
                </h2>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {copy.trajectoryEvidence}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {trajectory.evidence.map((preuve) => (
                  <li key={preuve} className="text-pretty">
                    {preuve}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {buildStaircase(shown, stepUpTitles, {
            stepUp: trajectory?.nextLevel ?? null,
            level: trajectory?.currentLevel ?? null,
          }).map((band) => (
            <section key={band.key} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">
                  {band.key === "step_up"
                    ? copy.bandStepUp(band.levelLabel)
                    : copy.bandLevel(band.levelLabel)}
                </h2>
                {band.key === "step_up" ? (
                  <p className="text-muted-foreground text-xs">
                    {copy.bandStepUpNote}
                  </p>
                ) : null}
              </div>
              <ul className="flex flex-col gap-3">
                {band.hits.map((hit) => (
                  <ResultRow key={hit.key} hit={hit} />
                ))}
              </ul>
            </section>
          ))}
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.noneShown}</p>
          ) : null}

          {/* `result === initialResult` n'est pas une précaution : l'affinage
              manuel remplace `result` par un objet neuf alors que
              `searchedTitles` reste la prop d'ouverture. Sans cette garde, la
              ligne affirmerait avoir cherché sous des intitulés qu'elle n'a
              pas utilisés — un mensonge d'autant plus traître qu'il est
              plausible. */}
          {searchedTitles.length > 0 && result === initialResult ? (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">
                {copy.searchedAs(searchedTitles)}
              </p>
              <p className="text-muted-foreground text-xs">
                {copy.searchedAsNote}
              </p>
            </div>
          ) : null}

          {/* Credits owed for the results ACTUALLY on screen. Several sources
              make a named mention and a link back a condition of use, and a
              per-card attribution does not satisfy a clause that asks for a
              visible credit on the set. Computed from the displayed hits, not
              from what is configured: crediting a source that returned nothing
              would misstate where these offers came from. */}
          {(() => {
            const credits = creditsFor(
              shown.flatMap((hit) => hit.sources.map((s) => s.name)),
            );
            if (credits.length === 0) return null;
            // Deux formes, parce que les clauses ne demandent pas la même
            // chose : un BADGE dimensionné pour Adzuna, une mention en ligne
            // pour les autres. Traiter les deux pareil, c'est soit sous-servir
            // l'une, soit encombrer les autres.
            const enBadge = credits.filter((c) => c.badge !== undefined);
            const enLigne = credits.filter((c) => c.badge === undefined);
            return (
              <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3">
                {enBadge.map((credit) => (
                  <a
                    key={credit.source}
                    href={credit.href}
                    target="_blank"
                    rel="noopener"
                    className="border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs whitespace-nowrap"
                    style={{
                      minWidth: credit.badge?.minWidth,
                      minHeight: credit.badge?.minHeight,
                    }}
                  >
                    {credit.prefix}
                    {credit.linkText}
                    {credit.suffix}
                  </a>
                ))}
                {enLigne.length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {enLigne.map((credit, index) => (
                      <span key={credit.source}>
                        {index > 0 ? " · " : ""}
                        {credit.prefix}
                        <a
                          href={credit.href}
                          target="_blank"
                          rel="noopener"
                          className="underline underline-offset-2"
                        >
                          {credit.linkText}
                        </a>
                        {credit.suffix}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            );
          })()}
        </>
      ) : null}

      <details
        open={refineOpen}
        onToggle={(e) => setRefineOpen(e.currentTarget.open)}
        className="border-border rounded-xl border p-4"
      >
        <summary className="cursor-pointer text-sm font-medium">
          {copy.refineSummary}
        </summary>
        <div className="flex flex-col gap-4 pt-4">
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
                ref={queryRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.queryPlaceholder}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              aria-busy={busy || undefined}
            >
              {busy ? copy.searching : copy.refine}
            </Button>
          </form>
          <p className="text-muted-foreground text-xs">{copy.queryHint}</p>

          {/* Countries drive the QUERY — a country-partitioned source is asked once
          per country — so they sit with the search box, not with the filters
          that merely narrow what came back. */}
          <div
            role="group"
            aria-label={copy.countriesLabel}
            className="flex flex-col gap-1"
          >
            <span className="text-muted-foreground text-xs">
              {copy.countriesLabel}
            </span>
            <div className="flex flex-wrap gap-2">
              {SEARCH_COUNTRIES.map((c) => {
                const on = countries.includes(c.code);
                const full =
                  !on && countries.length >= MAX_COUNTRIES_PER_SEARCH;
                return (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() =>
                      setCountries((prev) =>
                        prev.includes(c.code)
                          ? prev.filter((x) => x !== c.code)
                          : [...prev, c.code],
                      )
                    }
                    className={
                      on
                        ? "border-foreground bg-foreground text-background rounded-full border px-3 py-1 text-xs"
                        : full
                          ? "border-border text-muted-foreground rounded-full border px-3 py-1 text-xs opacity-50"
                          : "border-border rounded-full border px-3 py-1 text-xs"
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <span className="text-muted-foreground text-xs">
              {copy.countriesHint(MAX_COUNTRIES_PER_SEARCH)}
            </span>
          </div>
        </div>
      </details>
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

/** The pay line: what the offer SAID, plus an annual equivalent when we had to
 *  derive one — with the assumption named, never silently applied. */
function payLine(hit: MarketHit): string | null {
  const parts = payParts(hit);
  if (parts === null) return null;
  const copy = t().search;
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const bounds =
    parts.high === null
      ? fmt(parts.low)
      : `${fmt(parts.low)} – ${fmt(parts.high)}`;
  const unit = copy.compPeriods[hit.compensationPeriod ?? ""] ?? "";
  const stated = `${bounds} ${parts.currency}${unit ? ` / ${unit}` : ""}`;
  const annual = annualEquivalent(hit);
  // Only a DERIVED figure carries the "≈" and the assumption. An offer that
  // already stated an annual amount is shown in its own words.
  return annual && annual.converted
    ? copy.payConverted(stated, `${fmt(annual.amount)} ${annual.currency}`)
    : stated;
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
      {/* The falsifiable half of the match. Naming the skills lets the user
          check the claim against the posting; a bare percentage cannot be
          checked, so it is shown only as a secondary hint above. */}
      <p className="text-xs">
        {hit.demandedSkillCount === 0
          ? copy.skillsUnknown
          : hit.matchedSkills.length === 0
            ? copy.skillMatchNone(hit.demandedSkillCount)
            : `${copy.skillMatch(hit.matchedSkills.length, hit.demandedSkillCount)} : ${hit.matchedSkills.join(", ")}`}
      </p>
      {payLine(hit) ? (
        <p className="text-muted-foreground text-xs">{payLine(hit)}</p>
      ) : null}
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
      {/* EN DERNIER, et discret. C'est le seul geste de retour du produit, mais
          l'écran existe pour montrer des opportunités — placer « pas pour moi »
          avant le lien vers l'annonce inviterait à refuser avant de lire. */}
      <PasPourMoi />
    </li>
  );
}
