import { describe, expect, it } from "vitest";
import {
  buildSearchPlans,
  runSearchPlans,
  type SearchPlan,
} from "@/lib/discovery/plan";

const claim = (kind: string, state: string, value: unknown) => ({
  kind,
  state,
  value,
});

describe("buildSearchPlans", () => {
  it("prefers target métiers: one TITLE-targeted search per métier, max 3, deduped", () => {
    const plans = buildSearchPlans(
      [claim("role", "confirmed", { title: "CTO" })],
      [
        " Data Engineer ",
        "data engineer", // case-insensitive duplicate
        "Head of Data",
        "",
        "Engineering Manager",
        "Platform Lead", // over the cap of 3 — dropped
      ],
    );
    expect(plans).toEqual([
      { keywords: ["Data Engineer"], mode: "title" },
      { keywords: ["Head of Data"], mode: "title" },
      { keywords: ["Engineering Manager"], mode: "title" },
    ]);
  });

  it("falls back to ONE any-mode search over confirmed role + skills", () => {
    const plans = buildSearchPlans(
      [
        claim("role", "confirmed", { title: "Data Engineer" }),
        claim("skill", "confirmed", { name: "Spark" }),
        claim("skill", "proposed", { name: "Airflow" }), // not confirmed — out
        claim("skill", "confirmed", { name: "Python" }),
        claim("skill", "confirmed", { name: "Kafka" }),
        claim("skill", "confirmed", { name: "dbt" }), // over the keyword cap
      ],
      [],
    );
    expect(plans).toEqual([
      { keywords: ["Data Engineer", "Spark", "Python", "Kafka"], mode: "any" },
    ]);
  });

  it("returns no plan when neither targets nor confirmed claims exist", () => {
    expect(
      buildSearchPlans([claim("skill", "proposed", { name: "Go" })], ["  "]),
    ).toEqual([]);
  });
});

describe("runSearchPlans", () => {
  const plans: SearchPlan[] = [
    { keywords: ["Data Engineer"], mode: "title" },
    { keywords: ["Head of Data"], mode: "title" },
  ];
  const ad = (sourceUrl: string | null, rawText: string) => ({
    sourceUrl,
    rawText,
  });

  it("isolates a failing search and REPORTS it (honest partial results)", async () => {
    const errors: unknown[] = [];
    const { ads, failedSearches } = await runSearchPlans(
      plans,
      async (keywords) => {
        if (keywords[0] === "Head of Data") throw new Error("adzuna 429");
        return [ad("https://a.example/1", "Offre A")];
      },
      (_plan, error) => errors.push(error),
    );
    expect(ads).toHaveLength(1);
    expect(failedSearches).toBe(1); // surfaced, not just logged
    expect(errors).toHaveLength(1);
  });

  it("dedups ads across searches by provenance URL (fallback: verbatim text)", async () => {
    const byPlan: Record<
      string,
      { sourceUrl: string | null; rawText: string }[]
    > = {
      "Data Engineer": [
        ad("https://a.example/1", "Offre A"),
        ad(null, "Offre sans URL"),
      ],
      "Head of Data": [
        ad("https://a.example/1", "Offre A vue autrement"), // same URL — once
        ad(null, "Offre sans URL"), // same verbatim text — once
        ad("https://a.example/2", "Offre B"),
      ],
    };
    const { ads, failedSearches } = await runSearchPlans(
      plans,
      async (keywords) => byPlan[keywords[0]],
      () => {},
    );
    expect(failedSearches).toBe(0);
    expect(ads.map((a) => a.sourceUrl ?? a.rawText)).toEqual([
      "https://a.example/1",
      "Offre sans URL",
      "https://a.example/2",
    ]);
  });

  it("counts every search as failed when they all throw", async () => {
    const { ads, failedSearches } = await runSearchPlans(
      plans,
      async () => {
        throw new Error("down");
      },
      () => {},
    );
    expect(ads).toEqual([]);
    expect(failedSearches).toBe(plans.length);
  });
});
