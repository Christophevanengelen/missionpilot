import { describe, expect, it } from "vitest";
import { creditsFor } from "@/lib/discovery/credits";

describe("creditsFor", () => {
  it("credits nothing when nothing was displayed", () => {
    expect(creditsFor([])).toEqual([]);
  });

  it("renders Adzuna's clause with « Jobs » as the linked words", () => {
    // Their clause is specific: "Jobs by Adzuna" with "Jobs" hyperlinked. A
    // generic "source: Adzuna" line does not satisfy it.
    const [credit] = creditsFor(["Adzuna"]);
    expect(credit.linkText).toBe("Jobs");
    expect(credit.suffix).toBe(" by Adzuna");
    expect(credit.href).toContain("adzuna");
  });

  it("de-duplicates a source that produced many results", () => {
    expect(creditsFor(["Jobicy", "Jobicy", "Jobicy"])).toHaveLength(1);
  });

  it("ignores nulls and sources with no stated obligation", () => {
    // Silence is the safe default: an invented obligation is noise, and a
    // missing one is caught by the registry review rather than guessed here.
    expect(creditsFor([null, "Une source inconnue"])).toEqual([]);
  });

  it("orders credits stably so the block does not reshuffle", () => {
    const first = creditsFor(["Jobicy", "Adzuna", "Himalayas"]).map(
      (c) => c.source,
    );
    const second = creditsFor(["Himalayas", "Jobicy", "Adzuna"]).map(
      (c) => c.source,
    );
    expect(first).toEqual(second);
  });

  it("credits only what was actually shown", () => {
    // Crediting a configured source that returned nothing would misstate where
    // the visible offers came from — the product's honesty rule, aimed at us.
    expect(creditsFor(["Himalayas"]).map((c) => c.source)).toEqual([
      "Himalayas",
    ]);
  });
});
