/**
 * Deterministic ATS parse-safety linter (Phase 6 P5 — no AI, no external data,
 * operates on the user's OWN uploaded CV). Roughly a quarter of ATS parsing
 * failures are formatting/structure problems that silently drop an otherwise
 * strong senior CV before any human sees it. These checks are text-based and
 * conservative: every finding is one a real ATS would plausibly trip on, so
 * they are trustworthy by construction (we deliberately do NOT guess at column
 * or table layout, which text-only detection cannot do without false alarms).
 *
 * Honesty: findings are advisory signals about the FILE, never a score and
 * never a claim about the candidate.
 */

export type AtsFindingCode =
  "no_extractable_text" | "no_sections" | "no_contact" | "too_long";

export type AtsFinding = { code: AtsFindingCode; severity: "error" | "warn" };

// A CV whose text barely extracts is almost always a scanned image or an
// all-graphics layout — an ATS reads (nearly) nothing from it.
const MIN_CHARS_PER_PAGE = 120;
const MIN_TOTAL_CHARS = 200;
// Senior CVs run long, but past this an ATS/recruiter rarely reads on.
const MAX_PAGES = 3;

// Standard section headers an ATS keys on to segment a CV (FR + EN). Matched
// as whole words, accent- and case-insensitively.
const SECTION_TERMS = [
  "experience",
  "experiences",
  "parcours",
  "competences",
  "skills",
  "formation",
  "education",
  "diplome",
  "diplomes",
];

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function deburr(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Lint an extracted CV for ATS parse-safety. Pure: takes the already-extracted
 * text + page count, returns the findings (most severe first). An empty array
 * means no parse-safety problem was detected.
 */
export function lintCvForAts(input: {
  text: string;
  pageCount: number;
}): AtsFinding[] {
  const findings: AtsFinding[] = [];
  const text = input.text ?? "";
  const trimmedLen = text.trim().length;
  const pages = Math.max(1, input.pageCount || 1);

  // 1) Barely-extractable text ⇒ scanned/image PDF the ATS can't read.
  if (trimmedLen < MIN_TOTAL_CHARS || trimmedLen < MIN_CHARS_PER_PAGE * pages) {
    findings.push({ code: "no_extractable_text", severity: "error" });
    // With almost no text the remaining checks would only add noise.
    return findings;
  }

  // 2) No recognizable section header ⇒ the ATS cannot segment the CV.
  const haystack = deburr(text).toLowerCase();
  const hasSection = SECTION_TERMS.some((term) =>
    new RegExp(`\\b${term}\\b`).test(haystack),
  );
  if (!hasSection) findings.push({ code: "no_sections", severity: "warn" });

  // 3) No email ⇒ the ATS may fail to extract contact info.
  if (!EMAIL_RE.test(text)) {
    findings.push({ code: "no_contact", severity: "warn" });
  }

  // 4) Too long.
  if (pages > MAX_PAGES) findings.push({ code: "too_long", severity: "warn" });

  return findings;
}
