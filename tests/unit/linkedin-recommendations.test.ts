import { describe, expect, it } from "vitest";
import { buildCareerProfile } from "@/lib/profile/linkedin-export";

/**
 * The LinkedIn export the person already hands over contains two files the
 * parser used to ignore. An API investigation went looking for richer data and
 * found that the richest data was already sitting in the archive, unread.
 */

const RECOS = [
  "First Name,Last Name,Company,Job Title,Text,Status",
  'Marie,Durand,Acme,CTO,"A piloté une équipe de 12 sur 3 pays et un budget de 400 k€.",VISIBLE',
  'Paul,Martin,Beta,VP,"Excellent, mais brouillon en attente.",PENDING',
].join("\n");

const PREFS = [
  "Job Titles,Locations,Industries,Company Sizes",
  '"Head of Design,Design Director","Paris,Remote",Design,"201-500"',
].join("\n");

describe("recommendations received", () => {
  it("carries the scope a CV omits — the whole reason to read them", () => {
    const { text } = buildCareerProfile({ recommendationsReceived: RECOS });
    expect(text).toContain("une équipe de 12 sur 3 pays");
    expect(text).toContain("400 k€");
  });

  it("keeps them ATTRIBUTED, never merged into the person's own narrative", () => {
    // A recommendation is the only text on a profile written by someone else.
    // The career reading must not quote it as if the person's own record had
    // evidenced it, so the provenance travels with the text.
    const { text } = buildCareerProfile({ recommendationsReceived: RECOS });
    expect(text).toContain("écrites par des tiers");
    expect(text).toContain("Marie Durand");
    expect(text).toContain("CTO");
  });

  it("ignores anything not actually published", () => {
    // A pending recommendation may never have been accepted; it is not visible
    // on the profile and is not proof of anything.
    const { text } = buildCareerProfile({ recommendationsReceived: RECOS });
    expect(text).not.toContain("brouillon en attente");
  });

  it("adds nothing when the file is absent", () => {
    const { text } = buildCareerProfile({ profile: "Headline\nDesigner\n" });
    expect(text).not.toContain("Recommandations reçues");
  });

  it("skips a row whose text is empty rather than emitting a bare name", () => {
    const { text } = buildCareerProfile({
      recommendationsReceived: "First Name,Text,Status\nZoe,,VISIBLE\n",
    });
    expect(text).not.toContain("Zoe");
  });
});

describe("job seeker preferences", () => {
  it("records where the person projects themselves, not only where they came from", () => {
    // The one signal in the whole export that is about the NEXT rung.
    const { text } = buildCareerProfile({ jobSeekerPreferences: PREFS });
    expect(text).toContain("Ce que la personne vise");
    expect(text).toContain("Head of Design");
    expect(text).toContain("Paris,Remote");
  });

  it("omits the section entirely when nothing was declared", () => {
    const { text } = buildCareerProfile({
      jobSeekerPreferences: "Job Titles,Locations\n,\n",
    });
    expect(text).not.toContain("Ce que la personne vise");
  });

  it("adds nothing when the file is absent", () => {
    const { text } = buildCareerProfile({ profile: "Headline\nDesigner\n" });
    expect(text).not.toContain("Ce que la personne vise");
  });
});

describe("the rest of the export still behaves", () => {
  it("keeps reading positions and skills as before", () => {
    const { text, skills } = buildCareerProfile({
      positions: "Title,Company Name\nService Designer,Acme\n",
      skills: "Name\nFigma\nRecherche utilisateur\n",
      recommendationsReceived: RECOS,
      jobSeekerPreferences: PREFS,
    });
    expect(text).toContain("Service Designer");
    expect(skills).toEqual(["Figma", "Recherche utilisateur"]);
  });
});
