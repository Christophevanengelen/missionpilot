import { describe, expect, it } from "vitest";
import { summariseUnderstanding } from "@/lib/profile/understood";

describe("summariseUnderstanding", () => {
  it("says nothing is known when there are no claims", () => {
    const understood = summariseUnderstanding([]);
    expect(understood.empty).toBe(true);
    expect(understood.skills).toEqual([]);
    expect(understood.lines.every((l) => l.value === null)).toBe(true);
  });

  it("reads role, seniority and years back", () => {
    const understood = summariseUnderstanding([
      { kind: "role", value: { title: "Service Designer" } },
      { kind: "seniority", value: { level: "Senior" } },
      { kind: "years_experience", value: { years: 9 } },
    ]);
    expect(understood.empty).toBe(false);
    expect(understood.lines.map((l) => l.value)).toEqual([
      "Service Designer",
      "Senior",
      "9 ans",
    ]);
  });

  it("keeps a line as unknown rather than dropping it", () => {
    // The gaps must stay VISIBLE. A reading that shows only what it found looks
    // complete when it is not, and the product's honesty rule is that null
    // means "the source did not say".
    const understood = summariseUnderstanding([
      { kind: "skill", value: { name: "Figma" } },
    ]);
    expect(understood.lines).toHaveLength(3);
    expect(understood.lines.every((l) => l.value === null)).toBe(true);
    expect(understood.empty).toBe(false);
  });

  it("de-duplicates skills case-insensitively and keeps confirmation order", () => {
    const understood = summariseUnderstanding([
      { kind: "skill", value: { name: "Figma" } },
      { kind: "skill", value: { name: "Recherche utilisateur" } },
      { kind: "skill", value: { name: "figma" } },
    ]);
    expect(understood.skills).toEqual(["Figma", "Recherche utilisateur"]);
  });

  it("treats an unreadable claim as not known instead of throwing", () => {
    // A malformed row must never take down the only screen the product has.
    const understood = summariseUnderstanding([
      { kind: "role", value: null },
      { kind: "seniority", value: "Senior" },
      { kind: "years_experience", value: { years: Number.NaN } },
      { kind: "skill", value: { name: "   " } },
    ]);
    expect(understood.lines.every((l) => l.value === null)).toBe(true);
    expect(understood.skills).toEqual([]);
    expect(understood.empty).toBe(true);
  });

  it("prefers the first readable claim when several exist for one kind", () => {
    const understood = summariseUnderstanding([
      { kind: "role", value: {} },
      { kind: "role", value: { title: "Head of Design" } },
    ]);
    expect(understood.lines[0].value).toBe("Head of Design");
  });
});
