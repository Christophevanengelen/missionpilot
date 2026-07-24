/**
 * PDF → plain text extraction for CV upload (server-only). Isolated from the
 * pure detector so unit tests never pull the PDF engine. Uses `unpdf`
 * (serverless-friendly, no native deps). The extracted text is treated as
 * untrusted DATA — the detector reads it structurally, never as instructions.
 */
import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — a CV is small; reject large files.

export class CvPdfError extends Error {}

/** Extract the concatenated text of a PDF. Throws `CvPdfError` on bad input. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) throw new CvPdfError("empty file");
  if (bytes.byteLength > MAX_BYTES) throw new CvPdfError("file too large");
  try {
    const pdf = await getDocumentProxy(bytes);
    // mergePages: true → `text` is a single string.
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    throw new CvPdfError(
      error instanceof Error ? error.message : "could not read PDF",
    );
  }
}
