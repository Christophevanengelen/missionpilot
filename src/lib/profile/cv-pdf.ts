/**
 * PDF → plain text extraction for CV upload (server-only). Isolated from the
 * pure detector so unit tests never pull the PDF engine. Uses `unpdf`
 * (serverless-friendly, no native deps). The extracted text is treated as
 * untrusted DATA — the detector reads it structurally, never as instructions.
 */
import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — a CV is small; reject large files.
// Work bounds, independent of the byte size: a small crafted PDF can expand to
// enormous text (compression bomb) or thousands of pages. A CV never does.
const MAX_PAGES = 80;
const MAX_TEXT_CHARS = 300_000;

export class CvPdfError extends Error {}

/** Extracted text plus the page count (the latter feeds the ATS linter). */
export type ExtractedPdf = { text: string; pageCount: number };

/** Extract the text AND page count of a PDF. Throws `CvPdfError` on bad
 *  input. */
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  if (bytes.byteLength === 0) throw new CvPdfError("empty file");
  if (bytes.byteLength > MAX_BYTES) throw new CvPdfError("file too large");
  try {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > MAX_PAGES) throw new CvPdfError("too many pages");
    // mergePages: true → `text` is a single string.
    const { text } = await extractText(pdf, { mergePages: true });
    // Cap the downstream work; a real CV is far below this.
    return { text: text.slice(0, MAX_TEXT_CHARS), pageCount: pdf.numPages };
  } catch (error) {
    if (error instanceof CvPdfError) throw error;
    throw new CvPdfError(
      error instanceof Error ? error.message : "could not read PDF",
    );
  }
}

/** Extract the concatenated text of a PDF. Throws `CvPdfError` on bad input. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdf(bytes)).text;
}
