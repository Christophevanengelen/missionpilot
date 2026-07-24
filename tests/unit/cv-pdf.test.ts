import { describe, expect, it, vi } from "vitest";

// cv-pdf is a server-only module; neutralize the guard for unit testing.
vi.mock("server-only", () => ({}));

const { CvPdfError, extractPdfText } = await import("@/lib/profile/cv-pdf");

describe("extractPdfText — safety bounds", () => {
  it("rejects an empty file", async () => {
    await expect(extractPdfText(new Uint8Array(0))).rejects.toBeInstanceOf(
      CvPdfError,
    );
  });

  it("rejects an oversize file before parsing", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    await expect(extractPdfText(big)).rejects.toThrow(/file too large/);
  });

  it("wraps a corrupt PDF in a typed CvPdfError (never crashes)", async () => {
    const junk = new TextEncoder().encode("this is not a pdf at all");
    await expect(extractPdfText(junk)).rejects.toBeInstanceOf(CvPdfError);
  });
});
