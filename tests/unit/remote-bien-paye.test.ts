import { describe, expect, it } from "vitest";
import { COMP_CURRENCIES, COMP_PERIODS } from "@/domain/opportunity";

/**
 * The owner's brief, in one sentence: full-remote work in the United States and
 * Canada, in roles that pay well. Ranking by pay is only honest if the pay a
 * source actually published survives the pipeline — and three things were
 * quietly eating it.
 */

describe("what the engine is allowed to carry", () => {
  it("accepts Canadian dollars", () => {
    // Canadian remote roles were shown WITHOUT their salary: the source stated
    // 120 000–150 000 CAD in structured fields and the currency filter dropped
    // the whole block. The offer looked like it disclosed nothing when it had
    // disclosed everything.
    expect(COMP_CURRENCIES).toContain("CAD");
  });

  it("still refuses a currency nobody has verified", () => {
    // Widening is not opening: an unlisted code means "we have not checked how
    // this source states it", and guessing is how a figure lands under the
    // wrong unit.
    expect(COMP_CURRENCIES).not.toContain("AUD");
    expect(COMP_CURRENCIES).not.toContain("XXX");
  });

  it("carries an hourly rate", () => {
    // A US contract at 140 USD/hour is exactly the well-paid remote role this
    // product exists for.
    expect(COMP_PERIODS).toContain("hour");
  });
});
