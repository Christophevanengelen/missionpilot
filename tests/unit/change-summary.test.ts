import { describe, expect, it } from "vitest";
import {
  buildChangeSummary,
  buildRestoreSummary,
} from "@/lib/profile/change-summary";
import type { VersionContent } from "@/lib/profile/version-content";

function content(
  claims: Array<{
    kind: string;
    value: Record<string, unknown>;
    evidence?: number;
  }>,
): VersionContent {
  return {
    schema_version: 1,
    claims: claims.map((c, i) => ({
      kind: c.kind,
      value: c.value,
      evidence: Array.from({ length: c.evidence ?? 0 }, (_, j) => ({
        evidence_id: `e-${i}-${j}`,
        type: "achievement",
        title: `t${j}`,
        statement: `s${j}`,
        organization: null,
        role_played: null,
        start_date: null,
        end_date: null,
        verification_status: "user_confirmed",
        source_type: "user_stated",
        source_reference: null,
      })),
    })),
  };
}

describe("buildChangeSummary (French, deterministic)", () => {
  it("labels the very first version", () => {
    expect(buildChangeSummary(null, content([]))).toBe(
      "Première version publiée du profil.",
    );
  });

  it("describes single-valued updates in plain French", () => {
    const before = content([{ kind: "role", value: { title: "Designer" } }]);
    const after = content([
      { kind: "role", value: { title: "Lead Designer" } },
    ]);
    expect(buildChangeSummary(before, after)).toBe("Rôle mis à jour.");
    expect(buildChangeSummary(before, content([]))).toBe("Rôle retiré.");
  });

  it("agrees participles with a feminine singular label", () => {
    const empty = content([]);
    const senior = content([{ kind: "seniority", value: { level: "Senior" } }]);
    const principal = content([
      { kind: "seniority", value: { level: "Principal" } },
    ]);
    expect(buildChangeSummary(empty, senior)).toBe("Séniorité renseignée.");
    expect(buildChangeSummary(senior, empty)).toBe("Séniorité retirée.");
    expect(buildChangeSummary(senior, principal)).toBe(
      "Séniorité mise à jour.",
    );
  });

  it("agrees participles with a feminine plural label", () => {
    const empty = content([]);
    const eight = content([{ kind: "years_experience", value: { years: 8 } }]);
    const twelve = content([
      { kind: "years_experience", value: { years: 12 } },
    ]);
    expect(buildChangeSummary(empty, eight)).toBe(
      "Années d'expérience renseignées.",
    );
    expect(buildChangeSummary(eight, empty)).toBe(
      "Années d'expérience retirées.",
    );
    expect(buildChangeSummary(eight, twelve)).toBe(
      "Années d'expérience mises à jour.",
    );
  });

  it("counts skills added and removed with correct plurals", () => {
    const before = content([
      { kind: "skill", value: { name: "UX" } },
      { kind: "skill", value: { name: "A/B testing" } },
    ]);
    const after = content([
      { kind: "skill", value: { name: "UX" } },
      { kind: "skill", value: { name: "Design system" } },
      { kind: "skill", value: { name: "Recherche utilisateur" } },
    ]);
    expect(buildChangeSummary(before, after)).toBe(
      "2 compétences ajoutées · 1 compétence retirée.",
    );
  });

  it("reports newly attached evidence", () => {
    const before = content([
      { kind: "achievement", value: { title: "Checkout" }, evidence: 0 },
    ]);
    const after = content([
      { kind: "achievement", value: { title: "Checkout" }, evidence: 2 },
    ]);
    expect(buildChangeSummary(before, after)).toBe("2 preuves rattachées.");
  });

  it("combines several changes into one readable sentence", () => {
    const before = content([{ kind: "role", value: { title: "Designer" } }]);
    const after = content([
      { kind: "role", value: { title: "Lead Designer" } },
      { kind: "summary", value: { text: "20 ans d'expérience produit." } },
      { kind: "skill", value: { name: "UX" } },
    ]);
    expect(buildChangeSummary(before, after)).toBe(
      "Rôle mis à jour · Résumé renseigné · 1 compétence ajoutée.",
    );
  });

  it("stays honest when nothing hash-relevant changed", () => {
    const same = content([{ kind: "role", value: { title: "Designer" } }]);
    expect(buildChangeSummary(same, same)).toBe("Aucun changement de fond.");
  });

  it("names an evidence CONTENT edit even when counts are unchanged", () => {
    const before = content([
      { kind: "achievement", value: { title: "Checkout" }, evidence: 1 },
    ]);
    const after = structuredClone(before);
    after.claims[0].evidence[0].statement = "statement corrigé";
    expect(buildChangeSummary(before, after)).toBe(
      "Preuves rattachées mises à jour.",
    );
  });
});

describe("buildRestoreSummary", () => {
  it("names the restored version", () => {
    expect(buildRestoreSummary(3)).toBe("Restauration de la version 3.");
  });
});
