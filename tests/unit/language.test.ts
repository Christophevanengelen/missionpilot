import { describe, expect, it } from "vitest";
import { detectOpportunityLanguage } from "@/lib/matching/language";

// Deterministic FR/EN detection, from the OPPORTUNITY's own text only. Ties
// and no-signal text must resolve to "fr" — that is today's only observed
// behavior, and this module must not regress it (Apply Pack L3).

describe("detectOpportunityLanguage", () => {
  it("a clearly French listing resolves to fr", () => {
    expect(
      detectOpportunityLanguage(
        "Directeur de la création",
        "Nous recherchons pour notre entreprise un directeur de la création " +
          "avec une solide expérience dans le secteur, pour rejoindre notre " +
          "équipe et accompagner nos clients.",
      ),
    ).toBe("fr");
  });

  it("a clearly English listing resolves to en", () => {
    expect(
      detectOpportunityLanguage(
        "Head of Design",
        "We are looking for an experienced Head of Design to join our team " +
          "and work with our company, within a fast-growing organization.",
      ),
    ).toBe("en");
  });

  it("no title or description resolves to fr (no regression)", () => {
    expect(detectOpportunityLanguage(null, null)).toBe("fr");
  });

  it("a tie between fr and en signals resolves to fr", () => {
    // Same handful of words on each side of the ledger.
    expect(detectOpportunityLanguage("le role", "the poste")).toBe("fr");
  });

  it("accented French stopwords are recognized case-insensitively", () => {
    expect(
      detectOpportunityLanguage(
        "Chargé de mission",
        "Vous êtes autonome, vous avez le sens du contact avec nos équipes.",
      ),
    ).toBe("fr");
  });

  it("jargon-only text with no recognized stopword still resolves to fr", () => {
    expect(detectOpportunityLanguage("Kubernetes Terraform", "AWS GCP")).toBe(
      "fr",
    );
  });
});
