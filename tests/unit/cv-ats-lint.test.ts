import { describe, expect, it } from "vitest";
import { lintCvForAts } from "@/lib/profile/cv-ats-lint";

const codes = (r: { code: string }[]) => r.map((f) => f.code);

// A clean, ATS-friendly one-page CV: real text, standard sections, an email.
const GOOD =
  "Jean Dupont — jean.dupont@example.com\n\n" +
  "Expérience professionnelle\n" +
  "Ingénieur data senior chez Nova (2019–2024). Pipelines Spark et Airflow. " +
  "Conception d'entrepôts analytiques, encadrement d'une équipe de 4.\n\n" +
  "Compétences\nSpark, Python, SQL, dbt, Airflow.\n\n" +
  "Formation\nMSc Informatique, 2016.";

describe("lintCvForAts", () => {
  it("returns no finding for a clean, single-page, text CV", () => {
    expect(lintCvForAts({ text: GOOD, pageCount: 1 })).toEqual([]);
  });

  it("flags a barely-extractable (scanned image) PDF as an error and stops", () => {
    const r = lintCvForAts({ text: "  \n  ", pageCount: 2 });
    expect(r).toEqual([{ code: "no_extractable_text", severity: "error" }]);
  });

  it("flags a thin-per-page extraction even with some text", () => {
    // 3 pages but only a few words extracted ⇒ likely image-heavy layout.
    const r = lintCvForAts({ text: "Jean Dupont Ingénieur", pageCount: 3 });
    expect(codes(r)).toEqual(["no_extractable_text"]);
  });

  it("warns when no standard section header is present", () => {
    const noSections =
      "Jean Dupont jean@example.com. " +
      "J'ai travaillé chez Nova pendant cinq ans sur des pipelines de données, " +
      "puis chez Acme sur du reporting analytique et de la modélisation. ".repeat(
        3,
      );
    expect(codes(lintCvForAts({ text: noSections, pageCount: 1 }))).toContain(
      "no_sections",
    );
  });

  it("warns when no email is present", () => {
    const noEmail = GOOD.replace("jean.dupont@example.com", "(coordonnées)");
    expect(codes(lintCvForAts({ text: noEmail, pageCount: 1 }))).toContain(
      "no_contact",
    );
  });

  it("warns when the CV is over three pages", () => {
    const long = GOOD + "\n".repeat(10) + GOOD + GOOD; // enough text for 4 pages
    expect(codes(lintCvForAts({ text: long, pageCount: 4 }))).toContain(
      "too_long",
    );
  });

  it("accepts the plural French header 'Formations' (no spurious no_sections)", () => {
    // The ONLY section signal here is the plural header — the body deliberately
    // contains no other SECTION_TERM (no parcours/expérience/compétences/…), so
    // the test genuinely regresses if "formations" is dropped from the list.
    const cv =
      "Contact : a@b.co\nFormations\n" +
      "Master obtenu à l'université, puis plusieurs certifications reconnues " +
      "dans le domaine du numérique et de la donnée, sur dix années. ".repeat(
        2,
      );
    const result = codes(lintCvForAts({ text: cv, pageCount: 1 }));
    expect(result).not.toContain("no_sections");
    expect(result).not.toContain("no_contact"); // guard: email IS present
  });

  it("matches section terms accent- and case-insensitively", () => {
    const accented =
      "Contact: a@b.co\nEXPÉRIENCE\nDix ans de conseil en systèmes d'information " +
      "et en architecture de données pour des grands comptes européens. ".repeat(
        2,
      );
    expect(codes(lintCvForAts({ text: accented, pageCount: 1 }))).not.toContain(
      "no_sections",
    );
  });
});
