import { describe, expect, it } from "vitest";
import { buildSearchPlans } from "@/lib/discovery/plan";

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
