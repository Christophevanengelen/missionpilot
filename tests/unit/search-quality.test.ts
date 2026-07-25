import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isExpired, toPostedAt } from "@/lib/discovery/posted-at";
import { annualEquivalent, payParts } from "@/lib/search/compensation";
import { mergeDuplicates } from "@/lib/search/dedupe";
import {
  DEFAULT_MAX_AGE_DAYS,
  NO_FILTERS,
  filterHits,
  engagementFacets,
  remoteFacets,
  sortHits,
} from "@/lib/search/refine";
import type { MarketHit } from "@/lib/search/types";

const NOW = Date.parse("2026-07-25T12:00:00Z");

function hit(over: Partial<MarketHit> = {}): MarketHit {
  return {
    key: Math.random().toString(36),
    title: "Senior Service Designer",
    organization: "Nova",
    locationText: "Paris",
    engagementType: "freelance",
    remoteType: "remote_only",
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    skills: [],
    excerpt: null,
    postedAt: null,
    sources: [{ name: "Himalayas", url: "https://himalayas.app/1" }],
    sourceName: "Himalayas",
    sourceUrl: "https://himalayas.app/1",
    gate: "eligible",
    score: 50,
    confidence: "high",
    titlePhraseMatch: true,
    matchedSkills: [],
    demandedSkillCount: 0,
    unknowns: [],
    ...over,
  };
}

/**
 * Freshness is the first thing a job seeker reads, and the three sources state
 * it three different ways. Guessing a format is how a date lands months off.
 */
describe("toPostedAt", () => {
  it("reads each source's own format", () => {
    // Himalayas: Unix SECONDS (their real payload shape).
    expect(toPostedAt(Date.parse("2026-07-24T05:44:29Z") / 1000, NOW)).toBe(
      "2026-07-24T05:44:29.000Z",
    );
    // Jobicy: ISO with an offset.
    expect(toPostedAt("2026-07-25T11:30:03+00:00", NOW)).toBe(
      "2026-07-25T11:30:03.000Z",
    );
    // Remotive: ISO with NO offset — read as UTC, as documented.
    expect(toPostedAt("2026-07-24T10:33:35", NOW)).toBe(
      "2026-07-24T10:33:35.000Z",
    );
  });

  it("tells milliseconds from seconds", () => {
    const seconds = Date.parse("2026-07-24T05:44:29Z") / 1000;
    expect(toPostedAt(seconds * 1000, NOW)).toBe(toPostedAt(seconds, NOW));
  });

  it("returns null rather than inventing a date", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "  ",
      "bientôt",
      {},
      [],
      NaN,
      0,
      -5,
    ]) {
      expect(toPostedAt(bad, NOW)).toBeNull();
    }
  });

  it("refuses an implausible date instead of stamping it", () => {
    // A unit mix-up would land far in the future or far in the past; either
    // would be displayed as a confident "posted N days ago".
    expect(toPostedAt("2030-01-01T00:00:00Z", NOW)).toBeNull();
    expect(toPostedAt("2001-01-01T00:00:00Z", NOW)).toBeNull();
    // A few hours of clock skew stays acceptable.
    expect(toPostedAt("2026-07-25T18:00:00Z", NOW)).not.toBeNull();
  });
});

describe("isExpired", () => {
  it("drops a listing past its stated expiry", () => {
    expect(isExpired("2026-07-24T00:00:00Z", NOW)).toBe(true);
    expect(isExpired("2026-08-24T00:00:00Z", NOW)).toBe(false);
  });

  it("treats an absent or unreadable expiry as NOT expired", () => {
    // We do not know that it ended, so we must not act as if we did.
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired("n/a", NOW)).toBe(false);
  });
});

/**
 * The signature failure of a meta-search: the same job shown five times
 * because five boards carry it. URL dedup cannot catch it — each board
 * publishes its own URL.
 */
describe("mergeDuplicates", () => {
  it("merges the same posting seen on two platforms", () => {
    const merged = mergeDuplicates([
      hit({
        sourceName: "Himalayas",
        sources: [{ name: "Himalayas", url: "https://himalayas.app/1" }],
      }),
      hit({
        sourceName: "Jobicy",
        sources: [{ name: "Jobicy", url: "https://jobicy.com/2" }],
      }),
    ]);
    expect(merged).toHaveLength(1);
    // Both platforms are credited — which is also their contractual due.
    expect(merged[0].sources.map((s) => s.name)).toEqual([
      "Himalayas",
      "Jobicy",
    ]);
  });

  it("keeps the record that states the most", () => {
    const thin = hit({ unknowns: ["a", "b", "c"], locationText: null });
    const rich = hit({ unknowns: ["a"], locationText: "Paris, France" });
    expect(mergeDuplicates([thin, rich])[0].locationText).toBe("Paris, France");
    // …whichever order they arrive in.
    expect(mergeDuplicates([rich, thin])[0].locationText).toBe("Paris, France");
  });

  it("keeps the EARLIEST known publication date", () => {
    const merged = mergeDuplicates([
      hit({ postedAt: "2026-07-20T00:00:00Z" }),
      hit({ postedAt: "2026-07-24T00:00:00Z" }),
    ]);
    expect(merged[0].postedAt).toBe("2026-07-20T00:00:00Z");
  });

  it("never treats an unknown date as old", () => {
    const merged = mergeDuplicates([
      hit({ postedAt: null }),
      hit({ postedAt: "2026-07-24T00:00:00Z" }),
    ]);
    expect(merged[0].postedAt).toBe("2026-07-24T00:00:00Z");
  });

  it("does NOT merge when either half of the identity is missing", () => {
    // Unknown is not a match: two untitled offers are not the same offer.
    expect(
      mergeDuplicates([hit({ title: null }), hit({ title: null })]),
    ).toHaveLength(2);
    expect(
      mergeDuplicates([
        hit({ organization: null }),
        hit({ organization: null }),
      ]),
    ).toHaveLength(2);
  });

  it("does not merge different roles at the same company", () => {
    expect(
      mergeDuplicates([hit(), hit({ title: "Data Engineer" })]),
    ).toHaveLength(2);
  });

  it("matches across punctuation, case and accents", () => {
    expect(
      mergeDuplicates([
        hit({ title: "Senior Service Designer", organization: "Nova" }),
        hit({ title: "senior  service-designer", organization: "NOVA" }),
      ]),
    ).toHaveLength(1);
  });

  it("preserves the incoming order, so relevance ranking survives", () => {
    const merged = mergeDuplicates([
      hit({ title: "A", score: 90 }),
      hit({ title: "B", score: 50 }),
      hit({ title: "A", score: 90 }),
    ]);
    expect(merged.map((h) => h.title)).toEqual(["A", "B"]);
  });
});

describe("facets", () => {
  it("counts every option AND the unstated ones", () => {
    const hits = [
      hit({ engagementType: "freelance" }),
      hit({ engagementType: "freelance" }),
      hit({ engagementType: "permanent" }),
      hit({ engagementType: null }),
    ];
    const facets = engagementFacets(hits, NO_FILTERS, [
      "freelance",
      "permanent",
    ]);
    expect(facets).toEqual([
      { value: "freelance", count: 2 },
      { value: "permanent", count: 1 },
      // "Not stated" is a first-class countable value, not a silent residue.
      { value: null, count: 1 },
    ]);
  });

  it("counts over the OTHER filters, so a count predicts what clicking shows", () => {
    const hits = [
      hit({ engagementType: "freelance", remoteType: "remote_only" }),
      hit({ engagementType: "freelance", remoteType: "onsite" }),
    ];
    const facets = engagementFacets(
      hits,
      { ...NO_FILTERS, remoteTypes: ["remote_only"] },
      ["freelance"],
    );
    expect(facets[0]).toEqual({ value: "freelance", count: 1 });
  });

  it("does not let a dimension shrink its own counts", () => {
    // Selecting "remote only" must not make the other remote options read 0 —
    // the user could never widen back.
    const hits = [
      hit({ remoteType: "remote_only" }),
      hit({ remoteType: "onsite" }),
    ];
    const facets = remoteFacets(
      hits,
      { ...NO_FILTERS, remoteTypes: ["remote_only"] },
      ["remote_only", "onsite"],
    );
    expect(facets).toEqual([
      { value: "remote_only", count: 1 },
      { value: "onsite", count: 1 },
      { value: null, count: 0 },
    ]);
  });
});

describe("sortHits — freshness", () => {
  it("puts the newest first when descending", () => {
    const hits = [
      hit({ postedAt: "2026-07-20T00:00:00Z" }),
      hit({ postedAt: "2026-07-24T00:00:00Z" }),
    ];
    expect(
      sortHits(hits, { key: "freshness", direction: "desc" }).map(
        (h) => h.postedAt,
      ),
    ).toEqual(["2026-07-24T00:00:00Z", "2026-07-20T00:00:00Z"]);
  });

  it("sinks undated offers to the bottom in BOTH directions", () => {
    // An undated offer is not an old offer — it must never head the list of
    // "oldest first" either.
    const hits = [
      hit({ postedAt: null }),
      hit({ postedAt: "2026-07-24T00:00:00Z" }),
    ];
    for (const direction of ["asc", "desc"] as const) {
      expect(
        sortHits(hits, { key: "freshness", direction })[1].postedAt,
      ).toBeNull();
    }
  });
});

/**
 * The market hole the benchmark found nobody filling — and it bites hardest on
 * exactly this audience, where employee boards quote a year and mission boards
 * quote a day.
 */
describe("annualEquivalent", () => {
  const pay = (
    amount: number,
    period: string,
    currency: string | null = "EUR",
  ) => ({
    compensationMin: null,
    compensationMax: amount,
    compensationCurrency: currency,
    compensationPeriod: period,
  });

  it("annualises each period on the disclosed 218-day assumption", () => {
    expect(annualEquivalent(pay(90_000, "year"))?.amount).toBe(90_000);
    expect(annualEquivalent(pay(7_500, "month"))?.amount).toBe(90_000);
    expect(annualEquivalent(pay(600, "day"))?.amount).toBe(600 * 218);
    expect(annualEquivalent(pay(80, "hour"))?.amount).toBe(80 * 218 * 7);
  });

  it("flags a derived figure so the UI can say '≈' instead of quoting it", () => {
    expect(annualEquivalent(pay(90_000, "year"))?.converted).toBe(false);
    expect(annualEquivalent(pay(600, "day"))?.converted).toBe(true);
  });

  it("keeps the offer's own currency and never invents a rate", () => {
    // Converting USD to EUR would need a live rate we do not have. Inventing
    // one is exactly what this product refuses, so the currency travels as-is.
    expect(annualEquivalent(pay(120_000, "year", "USD"))?.currency).toBe("USD");
    expect(annualEquivalent(pay(120_000, "year", null))).toBeNull();
  });

  it("refuses an implausible annual equivalent rather than topping the list", () => {
    // A mis-extracted day rate would otherwise annualise into millions and
    // win every sort — ranking an offer first on a parsing bug.
    expect(annualEquivalent(pay(30_960, "day"))).toBeNull();
    expect(annualEquivalent(pay(0, "day"))).toBeNull();
  });

  it("returns null for a period it cannot annualise honestly", () => {
    expect(annualEquivalent(pay(1_000, "week"))).toBeNull();
  });
});

describe("sortHits — compensation across units", () => {
  it("ranks a day rate above an annual salary it actually beats", () => {
    // THE bug this fixes: raw figures put 90 000/an above 900/jour, though
    // the day rate is worth ~196 000 over a year. Every competitor gets this
    // wrong because they compare the printed number.
    const annual = hit({
      compensationMax: 90_000,
      compensationCurrency: "EUR",
      compensationPeriod: "year",
    });
    const daily = hit({
      compensationMax: 900,
      compensationCurrency: "EUR",
      compensationPeriod: "day",
    });
    expect(
      sortHits([annual, daily], { key: "compensation", direction: "desc" })[0]
        .compensationPeriod,
    ).toBe("day");
  });
});

describe("payParts", () => {
  const p = (
    min: number | null,
    max: number | null,
    currency: string | null = "EUR",
  ) => ({
    compensationMin: min,
    compensationMax: max,
    compensationCurrency: currency,
    compensationPeriod: "year",
  });

  // The production crash: an offer carried a CURRENCY with NO amount — the
  // extractor reads "EUR" in prose without a parseable figure — and a non-null
  // assertion on the amount took down the whole result list.
  it("returns null for a currency with no amount at all", () => {
    expect(payParts(p(null, null))).toBeNull();
  });

  it("returns null when there is no currency to show the amount in", () => {
    expect(payParts(p(90_000, 120_000, null))).toBeNull();
  });

  it("shows a single figure when only one bound is stated", () => {
    expect(payParts(p(90_000, null))).toEqual({
      low: 90_000,
      high: null,
      currency: "EUR",
    });
    expect(payParts(p(null, 90_000))).toEqual({
      low: 90_000,
      high: null,
      currency: "EUR",
    });
  });

  it("does not print a range when both bounds are the same number", () => {
    expect(payParts(p(90_000, 90_000))?.high).toBeNull();
  });

  it("shows a real range when the bounds differ", () => {
    expect(payParts(p(90_000, 120_000))).toEqual({
      low: 90_000,
      high: 120_000,
      currency: "EUR",
    });
  });
});

/**
 * The two ranking defects observed in production on the very first real search.
 */
describe("compareRelevance", () => {
  const rank = (hits: MarketHit[]) =>
    sortHits(hits, { key: "relevance", direction: "desc" });

  it("puts a real title match above scattered words", () => {
    // Observed: searching "Service Designer" returned "designers floraux pour
    // le service designer floral" first. Both words are in the title, so the
    // source was not wrong — the ranking was.
    const floral = hit({
      title:
        "Nos clients ont demandé designers floraux pour le service designer floral",
      titlePhraseMatch: false,
      score: 80,
    });
    const real = hit({
      title: "Senior Service Designer",
      titlePhraseMatch: true,
      score: 40,
    });
    expect(rank([floral, real])[0].title).toBe("Senior Service Designer");
  });

  it("does not reward an offer for stating nothing", () => {
    // An undecidable component is dropped from the average, so an offer that
    // says nothing can post a high score on one lucky component. Between two
    // offers, the one we know less about does not get to lead.
    const silent = hit({ confidence: "none", score: 95 });
    const judged = hit({ confidence: "high", score: 60 });
    expect(rank([silent, judged])[0].confidence).toBe("high");
  });

  it("falls back to the score when phrase and confidence tie", () => {
    const low = hit({ score: 20 });
    const high = hit({ score: 90 });
    expect(rank([low, high])[0].score).toBe(90);
  });

  it("reverses fully when the user asks for ascending", () => {
    const a = hit({ titlePhraseMatch: true, score: 90 });
    const b = hit({ titlePhraseMatch: false, score: 10 });
    expect(
      sortHits([a, b], { key: "relevance", direction: "asc" })[0]
        .titlePhraseMatch,
    ).toBe(false);
  });
});

describe("freshness filter", () => {
  const NOW_MS = Date.parse("2026-07-25T12:00:00Z");
  const daysAgo = (d: number) =>
    new Date(NOW_MS - d * 86_400_000).toISOString();

  it("drops a listing older than the window", () => {
    // Production showed 736-day-old ads leading a view of what is open NOW.
    const hits = [
      hit({ postedAt: daysAgo(736) }),
      hit({ postedAt: daysAgo(3) }),
    ];
    const kept = filterHits(
      hits,
      { ...NO_FILTERS, maxAgeDays: DEFAULT_MAX_AGE_DAYS },
      NOW_MS,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].postedAt).toBe(daysAgo(3));
  });

  it("NEVER drops an undated offer — unknown is not old", () => {
    const hits = [hit({ postedAt: null })];
    expect(
      filterHits(hits, { ...NO_FILTERS, maxAgeDays: 7 }, NOW_MS),
    ).toHaveLength(1);
  });

  it("keeps everything when the user lifts the limit", () => {
    const hits = [hit({ postedAt: daysAgo(736) })];
    expect(
      filterHits(hits, { ...NO_FILTERS, maxAgeDays: null }, NOW_MS),
    ).toHaveLength(1);
  });

  it("keeps an offer exactly on the boundary", () => {
    const hits = [hit({ postedAt: daysAgo(30) })];
    expect(
      filterHits(hits, { ...NO_FILTERS, maxAgeDays: 30 }, NOW_MS),
    ).toHaveLength(1);
  });
});
