import { describe, expect, it } from "vitest";
import { compareRanked, type Ranked } from "@/lib/matching/rank";

const sorted = (items: Ranked[]) => [...items].sort(compareRanked);

describe("compareRanked", () => {
  it("orders by gate first, regardless of score", () => {
    const out = sorted([
      { gate: "excluded", score: 99 },
      { gate: "review", score: 10 },
      { gate: "eligible", score: 1 },
    ]);
    expect(out.map((o) => o.gate)).toEqual(["eligible", "review", "excluded"]);
  });

  it("orders by score descending within a gate", () => {
    const out = sorted([
      { gate: "eligible", score: 40 },
      { gate: "eligible", score: 90 },
      { gate: "eligible", score: 70 },
    ]);
    expect(out.map((o) => o.score)).toEqual([90, 70, 40]);
  });

  it("places unscored (null) opportunities after scored ones in the same gate", () => {
    const out = sorted([
      { gate: "eligible", score: null },
      { gate: "eligible", score: 5 },
    ]);
    expect(out.map((o) => o.score)).toEqual([5, null]);
  });

  it("is stable for equal (gate, score) — preserves incoming order", () => {
    const a: Ranked & { tag: string } = {
      gate: "review",
      score: null,
      tag: "a",
    };
    const b: Ranked & { tag: string } = {
      gate: "review",
      score: null,
      tag: "b",
    };
    const out = [a, b].sort(compareRanked);
    expect(out.map((o) => o.tag)).toEqual(["a", "b"]);
  });
});
