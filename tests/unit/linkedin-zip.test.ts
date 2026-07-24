import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

vi.mock("server-only", () => ({}));

const { extractLinkedInFiles, LinkedInExportError } =
  await import("@/lib/profile/linkedin-zip");

function zip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries);
}

describe("extractLinkedInFiles", () => {
  it("pulls the whitelisted CSVs (case-insensitive basename), ignores the rest", () => {
    const archive = zip({
      "Profile.csv": "Headline\nSenior Data Engineer\n",
      "Positions.csv": "Title\nData Engineer\n",
      "SKILLS.CSV": "Name\nSpark\n",
      "Ads_Clicked.csv": "irrelevant\nrow\n", // ignored
      "media/photo.png": "not a csv",
    });
    const files = extractLinkedInFiles(archive);
    expect(files.profile).toContain("Senior Data Engineer");
    expect(files.positions).toContain("Data Engineer");
    expect(files.skills).toContain("Spark");
    expect(files.education).toBeUndefined();
  });

  it("resolves a nested layout by basename", () => {
    const files = extractLinkedInFiles(
      zip({ "Basic_LinkedInDataExport/Profile.csv": "Headline\nX\n" }),
    );
    expect(files.profile).toContain("X");
  });

  it("rejects an empty upload", () => {
    expect(() => extractLinkedInFiles(new Uint8Array(0))).toThrow(
      LinkedInExportError,
    );
  });

  it("rejects a non-zip payload", () => {
    expect(() => extractLinkedInFiles(strToU8("not a zip at all"))).toThrow(
      LinkedInExportError,
    );
  });

  it("rejects an archive that carries none of the wanted files", () => {
    expect(() =>
      extractLinkedInFiles(zip({ "Ads_Clicked.csv": "a\n1\n" })),
    ).toThrow(LinkedInExportError);
  });
});
