import { describe, expect, it } from "vitest";
import { canonicalizeSkill } from "@/domain/skill-aliases";

describe("canonicalizeSkill", () => {
  it("maps acronyms and spelling variants to a shared canonical", () => {
    expect(canonicalizeSkill("JS")).toBe(canonicalizeSkill("JavaScript"));
    expect(canonicalizeSkill("TS")).toBe(canonicalizeSkill("TypeScript"));
    expect(canonicalizeSkill("React.js")).toBe(canonicalizeSkill("react"));
    expect(canonicalizeSkill("k8s")).toBe(canonicalizeSkill("Kubernetes"));
    expect(canonicalizeSkill("Postgres")).toBe(canonicalizeSkill("PostgreSQL"));
    expect(canonicalizeSkill("golang")).toBe(canonicalizeSkill("Go"));
  });

  it("aligns FR↔EN translations of the same skill", () => {
    expect(canonicalizeSkill("gestion de projet")).toBe(
      canonicalizeSkill("Project Management"),
    );
    expect(canonicalizeSkill("intelligence artificielle")).toBe(
      canonicalizeSkill("AI"),
    );
    expect(canonicalizeSkill("expérience utilisateur")).toBe(
      canonicalizeSkill("UX"),
    );
  });

  it("trims, lower-cases and collapses whitespace", () => {
    expect(canonicalizeSkill("  Node   JS ")).toBe(
      canonicalizeSkill("node.js"),
    );
    expect(canonicalizeSkill("PYTHON")).toBe("python");
  });

  it("passes an unknown skill through as its normalized form (never invents)", () => {
    expect(canonicalizeSkill("Rust")).toBe("rust");
    expect(canonicalizeSkill("Elixir")).toBe("elixir");
  });

  it("does NOT alias loose semantic clusters (honesty: no fabricated match)", () => {
    // Salesforce IS a CRM but they are not the same skill — must stay distinct.
    expect(canonicalizeSkill("Salesforce")).not.toBe(canonicalizeSkill("CRM"));
  });

  it("keeps a subset skill distinct from its superset (CI ≠ CI/CD)", () => {
    // Continuous Integration is a subset of CI/CD, not an equivalence — folding
    // them would inflate the match score. FR↔EN CI translations DO align.
    expect(canonicalizeSkill("Continuous Integration")).not.toBe(
      canonicalizeSkill("CI/CD"),
    );
    expect(canonicalizeSkill("intégration continue")).toBe(
      canonicalizeSkill("Continuous Integration"),
    );
    expect(canonicalizeSkill("CICD")).toBe(canonicalizeSkill("CI/CD"));
  });
});
