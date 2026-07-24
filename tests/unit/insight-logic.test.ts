import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildOfferText,
  buildProfileDossier,
  insightInputHash,
  MAX_INSIGHTS_PER_RUN,
  pickInsightTargets,
} from "@/lib/matching/insight-logic";

const claim = (kind: string, state: string, value: unknown) => ({
  kind,
  state,
  value,
});

describe("buildProfileDossier", () => {
  it("uses CONFIRMED claims only, in a stable factual layout", () => {
    const dossier = buildProfileDossier(
      [
        claim("role", "confirmed", { title: "Data Engineer" }),
        claim("seniority", "confirmed", { level: "Senior" }),
        claim("years_experience", "confirmed", { years: 9 }),
        claim("summary", "confirmed", { text: "Pipelines à l'échelle." }),
        claim("skill", "confirmed", { name: "Spark" }),
        claim("skill", "proposed", { name: "Airflow" }), // not confirmed — out
      ],
      { targetRoleFamilies: ["Data Engineer", ""] },
    );
    expect(dossier).toBe(
      [
        "Rôle: Data Engineer (Senior) — 9 ans d'expérience",
        "Résumé: Pipelines à l'échelle.",
        "Compétences confirmées: Spark",
        "Métiers cibles: Data Engineer",
      ].join("\n"),
    );
  });

  it("is empty for a profile with nothing confirmed (the action refuses to judge)", () => {
    expect(
      buildProfileDossier([claim("skill", "proposed", { name: "Go" })], {
        targetRoleFamilies: [],
      }),
    ).toBe("");
  });

  it("stays empty with target métiers but ZERO confirmed claims (préférences ≠ faits de profil)", () => {
    // Regression (review PR #25): judging "your match" on preferences alone
    // would fabricate a profile the user never confirmed — no_profile must
    // hold even when targetRoleFamilies is set.
    expect(
      buildProfileDossier([claim("skill", "proposed", { name: "Go" })], {
        targetRoleFamilies: ["Data Engineer"],
      }),
    ).toBe("");
  });
});

describe("buildOfferText", () => {
  it("composes the normalized ad fields in a stable order, skipping unknowns", () => {
    expect(
      buildOfferText({
        title: "Head of Data",
        organization: "Nova SA",
        description: "Direction de la plateforme data.",
        skills: ["Spark", "dbt"],
        requirements: null,
      }),
    ).toBe(
      [
        "Head of Data",
        "chez Nova SA",
        "Direction de la plateforme data.",
        "Compétences demandées: Spark, dbt",
      ].join("\n"),
    );
  });
});

describe("insightInputHash", () => {
  it("is a stable 64-char hex fingerprint sensitive to BOTH inputs", () => {
    const h = insightInputHash("profil", "offre");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(insightInputHash("profil", "offre")).toBe(h);
    expect(insightInputHash("profil2", "offre")).not.toBe(h);
    expect(insightInputHash("profil", "offre2")).not.toBe(h);
    // The separator prevents boundary ambiguity ("ab"+"c" vs "a"+"bc").
    expect(insightInputHash("ab", "c")).not.toBe(insightInputHash("a", "bc"));
    // The separator BYTE is pinned: NUL (which Postgres text can never
    // contain) — a silent change (e.g. a tool normalizing the escape) would
    // invalidate every stored input_hash.
    expect(insightInputHash("a", "b")).toBe(
      createHash("sha256").update("a\x00b").digest("hex"),
    );
  });
});

describe("pickInsightTargets", () => {
  const dossier = "Rôle: Data Engineer";
  const row = (id: string, gate: "eligible" | "review" | "excluded") => ({
    id,
    gate,
    offerText: `Offre ${id}`,
  });

  it("skips excluded offers, fresh insights and empty texts; caps the run", () => {
    const ranked = [
      row("keep-1", "eligible"),
      row("skip-excluded", "excluded"),
      { id: "skip-empty", gate: "review" as const, offerText: "   " },
      row("skip-fresh", "review"),
      row("keep-2", "review"),
    ];
    const fresh = new Map([
      ["skip-fresh", insightInputHash(dossier, "Offre skip-fresh")],
      // A STALE hash (profile changed since) must be re-analyzed.
      ["keep-2", insightInputHash("ancien dossier", "Offre keep-2")],
    ]);
    const targets = pickInsightTargets(ranked, fresh, dossier);
    expect(targets.map((t) => t.opportunityId)).toEqual(["keep-1", "keep-2"]);
    expect(targets[0].inputHash).toBe(
      insightInputHash(dossier, "Offre keep-1"),
    );
  });

  it("never exceeds the cost bound", () => {
    const ranked = Array.from({ length: 30 }, (_, i) =>
      row(`o-${i}`, "eligible"),
    );
    expect(pickInsightTargets(ranked, new Map(), dossier)).toHaveLength(
      MAX_INSIGHTS_PER_RUN,
    );
  });
});
