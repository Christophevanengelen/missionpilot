import { describe, expect, it } from "vitest";
import { resolveChosenVariant } from "@/lib/matching/tailor-logic";

// The selection contract: the model may only echo an offered name; anything
// else — null, unknown, wrong case — resolves to "no choice", never a guess.

const VARIANTS = [
  { id: "a", name: "Design Lead" },
  { id: "b", name: "Product Lead" },
];

describe("resolveChosenVariant", () => {
  it("null means no choice", () => {
    expect(resolveChosenVariant(VARIANTS, null)).toBeNull();
  });

  it("an exact name resolves to its variant", () => {
    expect(resolveChosenVariant(VARIANTS, "Product Lead")?.id).toBe("b");
  });

  it("an unknown name is treated as no choice, never a guess", () => {
    expect(resolveChosenVariant(VARIANTS, "General")).toBeNull();
  });

  it("the match is exact, not fuzzy — case matters", () => {
    expect(resolveChosenVariant(VARIANTS, "design lead")).toBeNull();
  });

  it("an empty offer list resolves everything to null", () => {
    expect(resolveChosenVariant([], "Design Lead")).toBeNull();
  });
});
