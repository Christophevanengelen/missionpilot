import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  NO_FILTERS,
  filterHits,
  sortHits,
  unstatedCount,
  type MarketFilters,
} from "@/lib/search/refine";
import type { MarketHit } from "@/lib/search/types";

function hit(over: Partial<MarketHit> = {}): MarketHit {
  return {
    key: over.sourceUrl ?? Math.random().toString(36),
    title: "Service Designer",
    organization: "Nova",
    locationText: "Paris, Ile-de-France",
    engagementType: "freelance",
    remoteType: "remote_only",
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    skills: ["figma"],
    excerpt: "…",
    postedAt: null,
    sources: [{ name: "Himalayas", url: "https://himalayas.app/jobs/1" }],
    sourceName: "Himalayas",
    sourceUrl: "https://himalayas.app/jobs/1",
    gate: "eligible",
    score: 50,
    unknowns: [],
    ...over,
  };
}

describe("filterHits", () => {
  it("keeps everything when nothing is constrained", () => {
    const hits = [hit(), hit({ engagementType: null })];
    expect(filterHits(hits, NO_FILTERS)).toHaveLength(2);
  });

  // THE case this module exists for. A real production offer (Schneider
  // Electric, via Adzuna) stated NONE of engagement type, seniority, remote
  // mode or compensation. Dropping unstated offers would empty the list and
  // hide good matches whose only fault is a terse source.
  it("keeps an offer whose criterion is UNSTATED, by default", () => {
    const hits = [
      hit({ engagementType: "freelance" }),
      hit({ engagementType: "permanent" }),
      hit({ engagementType: null }), // the source did not say
    ];
    const kept = filterHits(hits, {
      ...NO_FILTERS,
      engagementTypes: ["freelance"],
    });
    expect(kept.map((h) => h.engagementType)).toEqual(["freelance", null]);
  });

  it("excludes unstated ONLY when explicitly asked", () => {
    const hits = [
      hit({ engagementType: "freelance" }),
      hit({ engagementType: null }),
    ];
    const strict: MarketFilters = {
      ...NO_FILTERS,
      engagementTypes: ["freelance"],
      includeUnstated: false,
    };
    expect(filterHits(hits, strict)).toHaveLength(1);
  });

  it("never confuses 'does not match' with 'did not say'", () => {
    // A stated mismatch is dropped even when unstated values are welcome.
    const hits = [hit({ remoteType: "onsite" })];
    expect(
      filterHits(hits, { ...NO_FILTERS, remoteTypes: ["remote_only"] }),
    ).toHaveLength(0);
  });

  it("matches a country ignoring case and accents", () => {
    const hits = [
      hit({ locationText: "Paris, Île-de-France" }),
      hit({ locationText: "Bruxelles, Belgique" }),
    ];
    const kept = filterHits(hits, { ...NO_FILTERS, countries: ["belgique"] });
    expect(kept).toHaveLength(1);
    expect(kept[0].locationText).toContain("Bruxelles");

    expect(
      filterHits(hits, { ...NO_FILTERS, countries: ["ile-de-france"] }),
    ).toHaveLength(1);
  });

  it("treats a missing location as unstated, not as a mismatch", () => {
    const hits = [hit({ locationText: null }), hit({ locationText: "   " })];
    expect(
      filterHits(hits, { ...NO_FILTERS, countries: ["France"] }),
    ).toHaveLength(2);
    expect(
      filterHits(hits, {
        ...NO_FILTERS,
        countries: ["France"],
        includeUnstated: false,
      }),
    ).toHaveLength(0);
  });

  it("combines criteria as AND", () => {
    const hits = [
      hit({ engagementType: "freelance", remoteType: "remote_only" }),
      hit({ engagementType: "freelance", remoteType: "onsite" }),
    ];
    expect(
      filterHits(hits, {
        ...NO_FILTERS,
        engagementTypes: ["freelance"],
        remoteTypes: ["remote_only"],
      }),
    ).toHaveLength(1);
  });
});

describe("unstatedCount", () => {
  it("counts only the offers unstated on a CONSTRAINED criterion", () => {
    const hits = [hit({ engagementType: null }), hit({ remoteType: null })];
    // Nothing constrained: nothing to warn about.
    expect(unstatedCount(hits, NO_FILTERS)).toBe(0);
    expect(
      unstatedCount(hits, { ...NO_FILTERS, engagementTypes: ["freelance"] }),
    ).toBe(1);
  });
});

describe("sortHits", () => {
  it("orders by relevance descending by default", () => {
    const hits = [hit({ score: 10 }), hit({ score: 90 }), hit({ score: 50 })];
    expect(sortHits(hits, DEFAULT_SORT).map((h) => h.score)).toEqual([
      90, 50, 10,
    ]);
  });

  it("reverses on demand — first and last are the user's choice", () => {
    const hits = [hit({ score: 10 }), hit({ score: 90 })];
    expect(
      sortHits(hits, { key: "relevance", direction: "asc" }).map(
        (h) => h.score,
      ),
    ).toEqual([10, 90]);
  });

  it("sinks offers with no value to the BOTTOM in both directions", () => {
    // Sorting by salary ascending must not fill the top of the screen with
    // offers that simply never mentioned one: absence is not a low figure.
    const hits = [
      hit({ compensationMax: null }),
      hit({ compensationMax: 90000 }),
      hit({ compensationMax: 50000 }),
    ];
    expect(
      sortHits(hits, { key: "compensation", direction: "asc" }).map(
        (h) => h.compensationMax,
      ),
    ).toEqual([50000, 90000, null]);
    expect(
      sortHits(hits, { key: "compensation", direction: "desc" }).map(
        (h) => h.compensationMax,
      ),
    ).toEqual([90000, 50000, null]);
  });

  it("falls back to the lower bound when only it is stated", () => {
    const hits = [
      hit({ compensationMin: 70000, compensationMax: null }),
      hit({ compensationMin: null, compensationMax: 60000 }),
    ];
    expect(
      sortHits(hits, { key: "compensation", direction: "desc" }).map(
        (h) => h.compensationMin ?? h.compensationMax,
      ),
    ).toEqual([70000, 60000]);
  });

  it("sorts text keys ignoring case and accents", () => {
    const hits = [
      hit({ organization: "Zeta" }),
      hit({ organization: "Élan" }),
      hit({ organization: "alpha" }),
    ];
    expect(
      sortHits(hits, { key: "organization", direction: "asc" }).map(
        (h) => h.organization,
      ),
    ).toEqual(["alpha", "Élan", "Zeta"]);
  });

  it("keeps the incoming order on ties, so relevance survives underneath", () => {
    const hits = [
      hit({ organization: "Nova", score: 90 }),
      hit({ organization: "Nova", score: 10 }),
    ];
    expect(
      sortHits(hits, { key: "organization", direction: "asc" }).map(
        (h) => h.score,
      ),
    ).toEqual([90, 10]);
  });

  it("does not mutate its input", () => {
    const hits = [hit({ score: 10 }), hit({ score: 90 })];
    sortHits(hits, DEFAULT_SORT);
    expect(hits.map((h) => h.score)).toEqual([10, 90]);
  });
});
