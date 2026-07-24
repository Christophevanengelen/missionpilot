import { describe, expect, it } from "vitest";
import {
  buildCareerProfile,
  parseCsv,
  parseCsvRecords,
} from "@/lib/profile/linkedin-export";

describe("parseCsv", () => {
  it("handles quoted fields, escaped quotes, embedded commas and newlines", () => {
    const csv =
      "a,b,c\r\n" +
      '"hello, world","line1\nline2","say ""hi"""\r\n' +
      "plain,,z\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["hello, world", "line1\nline2", 'say "hi"'],
      ["plain", "", "z"],
    ]);
  });

  it("parses records keyed by lower-cased header; skips header-only files", () => {
    expect(parseCsvRecords("Name\nReact\nGo\n")).toEqual([
      { name: "React" },
      { name: "Go" },
    ]);
    expect(parseCsvRecords("Name\n")).toEqual([]);
    expect(parseCsvRecords("")).toEqual([]);
  });
});

describe("buildCareerProfile", () => {
  it("weaves the export CSVs into a career narrative + declared skills", () => {
    const { text, skills } = buildCareerProfile({
      profile:
        "First Name,Last Name,Headline,Summary,Industry\n" +
        '"Ada","Lovelace","Senior Data Engineer","Pipelines at scale.","Software"\n',
      positions:
        "Company Name,Title,Description,Location,Started On,Finished On\n" +
        '"Nova","Data Engineer","Built Spark pipelines","Paris","Jan 2020","Jan 2024"\n' +
        '"Acme","Analyst","Reporting","Lyon","2018",""\n',
      skills: "Name\nSpark\nPython\nSpark\n", // duplicate dropped
      education:
        "School Name,Degree Name,Start Date,End Date\n" +
        '"EPFL","MSc Computer Science","2014","2016"\n',
    });

    expect(text).toContain("Senior Data Engineer");
    expect(text).toContain("Secteur : Software");
    expect(text).toContain("Résumé : Pipelines at scale.");
    expect(text).toContain(
      "Data Engineer chez Nova (Jan 2020 – Jan 2024) Paris",
    );
    expect(text).toContain("Built Spark pipelines");
    // An open-ended position shows "présent".
    expect(text).toContain("Analyst chez Acme (2018 – présent) Lyon");
    expect(text).toContain("MSc Computer Science – EPFL (2014 – 2016)");
    expect(text).toContain("Compétences déclarées : Spark, Python");

    expect(skills).toEqual(["Spark", "Python"]);
  });

  it("omits absent sections and never invents (honesty)", () => {
    const { text, skills } = buildCareerProfile({
      skills: "Name\nFigma\n",
    });
    expect(text).toBe("Compétences déclarées : Figma");
    expect(text).not.toMatch(/Expériences|Formation|Secteur|Résumé/);
    expect(skills).toEqual(["Figma"]);
  });

  it("tolerates alternate column names (Company / Start Date / Degree)", () => {
    const { text } = buildCareerProfile({
      positions:
        "Company,Title,Start Date,End Date\n" + '"Nova","Lead","2020","2022"\n',
    });
    expect(text).toContain("Lead chez Nova (2020 – 2022)");
  });

  it("returns empty for an export with no usable content", () => {
    expect(buildCareerProfile({})).toEqual({ text: "", skills: [] });
  });
});
