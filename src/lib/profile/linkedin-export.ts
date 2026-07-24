/**
 * LinkedIn OFFICIAL data-export parsing (owner-approved legal path — the user
 * requests "Get a copy of your data" from LinkedIn and uploads the ZIP; we
 * NEVER scrape LinkedIn). Pure and testable: this module knows nothing about
 * unzipping or the network — it takes already-decoded CSV strings and turns
 * them into the same kind of career narrative a CV yields, so the identical
 * downstream pipeline (LLM understanding or the deterministic detector →
 * validation → discovery → scoring) applies unchanged.
 *
 * The CSV content is untrusted DATA: it is read structurally by column name
 * and only ever becomes narrative text a human validates, never instructions.
 */

/** Minimal RFC 4180 CSV parser: quoted fields, escaped "" quotes, embedded
 *  commas and newlines. Returns rows of string cells. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Normalize CRLF/CR to LF so newline handling is uniform.
  const text = input.replace(/\r\n?/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  // Flush the trailing cell/row unless the input ended on a clean newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Parse a CSV into objects keyed by (trimmed, lower-cased) header name. An
 *  empty or header-only file yields an empty list. */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });
}

/** Case-insensitive lookup of the first present column among aliases. */
function field(rec: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const v = rec[a.toLowerCase()];
    if (v && v.trim() !== "") return v.trim();
  }
  return "";
}

/** The subset of the export we read, by canonical filename (case-insensitive
 *  match is done by the caller). */
export type LinkedInFiles = {
  profile?: string;
  positions?: string;
  skills?: string;
  education?: string;
};

const MAX_POSITIONS = 30;
const MAX_EDUCATION = 15;
const MAX_SKILLS = 100;
const MAX_TEXT_CHARS = 300_000;

/**
 * Build a career narrative + declared-skills list from the export CSVs. Only
 * what the export actually states is included — absent fields are simply
 * omitted (honesty: never invented). The declared skills come from Skills.csv
 * (the user's own list) and are also folded into the text so the LLM and the
 * deterministic detector both see them.
 */
export function buildCareerProfile(files: LinkedInFiles): {
  text: string;
  skills: string[];
} {
  const lines: string[] = [];

  const profile = parseCsvRecords(files.profile ?? "")[0];
  if (profile) {
    const headline = field(profile, "Headline");
    const summary = field(profile, "Summary");
    const industry = field(profile, "Industry");
    if (headline) lines.push(headline);
    if (industry) lines.push(`Secteur : ${industry}`);
    if (summary) lines.push(`Résumé : ${summary}`);
  }

  const positions = parseCsvRecords(files.positions ?? "").slice(
    0,
    MAX_POSITIONS,
  );
  if (positions.length > 0) {
    lines.push("", "Expériences :");
    for (const p of positions) {
      const title = field(p, "Title");
      const company = field(p, "Company Name", "Company");
      const location = field(p, "Location");
      const start = field(p, "Started On", "Start Date");
      const finish = field(p, "Finished On", "End Date") || "présent";
      const description = field(p, "Description");
      const head = [
        title || null,
        company ? `chez ${company}` : null,
        start ? `(${start} – ${finish})` : null,
        location || null,
      ]
        .filter(Boolean)
        .join(" ");
      if (head) lines.push(`- ${head}`);
      if (description) lines.push(`  ${description}`);
    }
  }

  const education = parseCsvRecords(files.education ?? "").slice(
    0,
    MAX_EDUCATION,
  );
  if (education.length > 0) {
    lines.push("", "Formation :");
    for (const e of education) {
      const degree = field(e, "Degree Name", "Degree");
      const school = field(e, "School Name", "School");
      const start = field(e, "Start Date");
      const end = field(e, "End Date");
      const span = start || end ? ` (${start} – ${end})` : "";
      const head = [degree || null, school ? `– ${school}` : null]
        .filter(Boolean)
        .join(" ");
      if (head) lines.push(`- ${head}${span}`);
    }
  }

  // Declared skills — de-duplicated, order preserved.
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const rec of parseCsvRecords(files.skills ?? "")) {
    const name = field(rec, "Name", "Skill");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    skills.push(name);
    if (skills.length >= MAX_SKILLS) break;
  }
  if (skills.length > 0) {
    lines.push("", `Compétences déclarées : ${skills.join(", ")}`);
  }

  return {
    text: lines.join("\n").slice(0, MAX_TEXT_CHARS).trim(),
    skills,
  };
}
