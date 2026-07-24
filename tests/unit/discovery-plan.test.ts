import { describe, expect, it } from "vitest";
import {
  buildSearchPlans,
  runMultiSourceDiscovery,
  type DiscoverySource,
  type SearchPlan,
} from "@/lib/discovery/plan";

type Ad = { sourceUrl: string | null; rawText: string };
const src = (
  name: string,
  search: DiscoverySource<Ad>["search"],
): DiscoverySource<Ad> => ({ name, search });

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

describe("runMultiSourceDiscovery", () => {
  const plans: SearchPlan[] = [
    { keywords: ["Data Engineer"], mode: "title" },
    { keywords: ["Head of Data"], mode: "title" },
  ];
  const ad = (sourceUrl: string | null, rawText: string): Ad => ({
    sourceUrl,
    rawText,
  });

  it("isolates a failing (source, search) and REPORTS it with its source name", async () => {
    const errors: string[] = [];
    const { items, failedSearches, totalSearches } =
      await runMultiSourceDiscovery(
        plans,
        [
          src("Adzuna", async (keywords) => {
            if (keywords[0] === "Head of Data") throw new Error("429");
            return [ad("https://a.example/1", "Offre A")];
          }),
        ],
        (sourceName) => errors.push(sourceName),
      );
    expect(items).toHaveLength(1);
    expect(items[0].sourceName).toBe("Adzuna");
    expect(failedSearches).toBe(1);
    expect(totalSearches).toBe(2); // 1 source × 2 plans
    expect(errors).toEqual(["Adzuna"]);
  });

  it("dedups ACROSS sources and plans, keeping the first source's provenance", async () => {
    const { items, failedSearches } = await runMultiSourceDiscovery(
      plans,
      [
        src("Adzuna", async () => [ad("https://x/1", "A"), ad(null, "noUrl")]),
        src("France Travail", async () => [
          ad("https://x/1", "A vue autrement"), // same URL — dropped
          ad(null, "noUrl"), // same verbatim text — dropped
          ad("https://x/2", "B"), // new — kept, tagged France Travail
        ]),
      ],
      () => {},
    );
    expect(failedSearches).toBe(0);
    expect(
      items.map((i) => [i.ad.sourceUrl ?? i.ad.rawText, i.sourceName]),
    ).toEqual([
      ["https://x/1", "Adzuna"],
      ["noUrl", "Adzuna"],
      ["https://x/2", "France Travail"],
    ]);
  });

  it("counts every search as failed when they all throw", async () => {
    const { items, failedSearches, totalSearches } =
      await runMultiSourceDiscovery(
        plans,
        [
          src("Adzuna", async () => {
            throw new Error("down");
          }),
          src("France Travail", async () => {
            throw new Error("down");
          }),
        ],
        () => {},
      );
    expect(items).toEqual([]);
    expect(failedSearches).toBe(4); // 2 sources × 2 plans
    expect(totalSearches).toBe(4);
  });
});
