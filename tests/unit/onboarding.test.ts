import { describe, expect, it } from "vitest";
import { summarizeOnboarding } from "@/lib/profile/onboarding";

const claim = (kind: string, state: string, value: unknown) => ({
  kind,
  state,
  value,
});

describe("summarizeOnboarding", () => {
  it("first login (nothing confirmed) ⇒ hasProfile false, drives the CV hero", () => {
    const s = summarizeOnboarding(
      [claim("skill", "proposed", { name: "Go" })], // proposal ≠ profile
      0,
      0,
      [],
    );
    expect(s.hasProfile).toBe(false);
    expect(s.roleTitle).toBeNull();
    expect(s.confirmedSkills).toBe(0);
  });

  it("a confirmed role alone flips to the status view", () => {
    const s = summarizeOnboarding(
      [claim("role", "confirmed", { title: "Data Engineer" })],
      0,
      0,
      ["Data Engineer"],
    );
    expect(s.hasProfile).toBe(true);
    expect(s.roleTitle).toBe("Data Engineer");
    expect(s.confirmedSkills).toBe(0);
    expect(s.targetRoles).toEqual(["Data Engineer"]);
  });

  it("a confirmed skill alone also counts as a profile", () => {
    const s = summarizeOnboarding(
      [claim("skill", "confirmed", { name: "Spark" })],
      0,
      0,
      [],
    );
    expect(s.hasProfile).toBe(true);
    expect(s.confirmedSkills).toBe(1);
  });

  it("counts only CONFIRMED skills and passes offer/analysis counts through", () => {
    const s = summarizeOnboarding(
      [
        claim("role", "confirmed", { title: "Head of Data" }),
        claim("skill", "confirmed", { name: "Spark" }),
        claim("skill", "confirmed", { name: "Python" }),
        claim("skill", "proposed", { name: "dbt" }), // not counted
        claim("skill", "rejected", { name: "PHP" }), // not counted
      ],
      7,
      3,
      ["Head of Data", ""],
    );
    expect(s.confirmedSkills).toBe(2);
    expect(s.opportunities).toBe(7);
    expect(s.analyzed).toBe(3);
    expect(s.targetRoles).toEqual(["Head of Data"]); // blanks dropped
  });
});
