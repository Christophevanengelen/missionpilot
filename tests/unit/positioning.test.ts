import { describe, expect, it } from "vitest";
import {
  buildPositioning,
  MIN_OFFERS_FOR_POSITIONING,
} from "@/lib/matching/positioning";

const offer = (skills: string[] | null) => ({ skills });

describe("buildPositioning", () => {
  it("is null when the corpus is too small to say anything honestly", () => {
    const offers = Array.from({ length: MIN_OFFERS_FOR_POSITIONING - 1 }, () =>
      offer(["Go"]),
    );
    expect(buildPositioning(offers, ["Go"])).toBeNull();
  });

  it("ignores offers with no skills when sizing the corpus", () => {
    // 4 offers but only 2 carry skills ⇒ still below the floor.
    const offers = [offer(["Go"]), offer(["Go"]), offer(null), offer([])];
    expect(buildPositioning(offers, ["Go"])).toBeNull();
  });

  it("ranks demand by number of offers and flags what the profile covers", () => {
    const p = buildPositioning(
      [
        offer(["Go", "Kubernetes"]),
        offer(["Go", "Terraform"]),
        offer(["Go", "Kubernetes"]),
        offer(["Rust"]),
      ],
      ["Go"],
    )!;
    expect(p.corpusSize).toBe(4);
    expect(p.topSkills[0]).toMatchObject({
      label: "Go",
      offers: 3,
      share: 75,
      covered: true,
    });
    expect(p.topSkills[1]).toMatchObject({ label: "Kubernetes", offers: 2 });
    // Kubernetes/Terraform/Rust are not in the profile.
    expect(p.topSkills.filter((s) => s.covered).map((s) => s.label)).toEqual([
      "Go",
    ]);
    expect(p.coverage).toBe(25); // 1 of 4 top skills covered
  });

  it("counts a skill ONCE per offer even if the listing repeats it", () => {
    const p = buildPositioning(
      [
        offer(["Go", "go", "GO"]),
        offer(["Go"]),
        offer(["Go"]),
        offer(["Rust"]),
      ],
      [],
    )!;
    expect(p.topSkills[0]).toMatchObject({ label: "Go", offers: 3, share: 75 });
  });

  it("caps the picture at the top 8 demanded skills, most demanded first", () => {
    // 12 distinct skills with strictly decreasing demand: only the top 8 show.
    const offers = Array.from({ length: 12 }, (_, i) =>
      // skill i appears in (12 - i) offers
      Array.from({ length: 12 - i }, () => `skill-${i}`),
    )
      .flat()
      .map((sk) => offer([sk]));
    const p = buildPositioning(offers, [])!;
    expect(p.topSkills).toHaveLength(8);
    expect(p.topSkills.map((s) => s.label)).toEqual([
      "skill-0",
      "skill-1",
      "skill-2",
      "skill-3",
      "skill-4",
      "skill-5",
      "skill-6",
      "skill-7",
    ]);
  });

  it("computes coverage over the TOP skills only (the copy says 'top 8')", () => {
    // 9 demanded skills; the profile covers only the 9th (rank 9 ⇒ outside the
    // top 8) ⇒ coverage is 0%, not 11%: the denominator is the shown top list.
    const offers = Array.from({ length: 9 }, (_, i) =>
      Array.from({ length: 9 - i }, () => `sk-${i}`),
    )
      .flat()
      .map((sk) => offer([sk]));
    const p = buildPositioning(offers, ["sk-8"])!;
    expect(p.topSkills).toHaveLength(8);
    expect(p.topSkills.some((s) => s.label === "sk-8")).toBe(false);
    expect(p.coverage).toBe(0);
  });

  it("aligns aliases (k8s ↔ Kubernetes) on both demand and profile sides", () => {
    const p = buildPositioning(
      [offer(["k8s"]), offer(["Kubernetes"]), offer(["K8S"])],
      ["kubernetes"],
    )!;
    expect(p.topSkills).toHaveLength(1);
    expect(p.topSkills[0]).toMatchObject({ offers: 3, covered: true });
    expect(p.coverage).toBe(100);
  });
});
