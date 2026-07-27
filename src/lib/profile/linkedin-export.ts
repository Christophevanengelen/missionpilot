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
  recommendationsReceived?: string;
  jobSeekerPreferences?: string;
};

/**
 * Les mêmes données, déjà décodées en enregistrements.
 *
 * C'est la forme PIVOT du parcours LinkedIn, et elle existe parce qu'il y a
 * désormais deux façons d'obtenir ces données — l'archive officielle, en CSV,
 * et l'API Member Data Portability, en JSON. Les faire converger ici plutôt
 * que d'écrire un second constructeur n'est pas de l'économie de code : les
 * règles d'honnêteté vivent dans le corps de `buildCareerProfileFromRecords`
 * (recommandations gardées attribuées et filtrées sur VISIBLE, champs absents
 * jamais inventés, plafonds). Un deuxième chemin serait un chemin où l'on
 * pourrait les oublier.
 *
 * CONTRAT : les clés doivent être en MINUSCULES. `parseCsvRecords` minuscule
 * les en-têtes et `field()` cherche en minuscules ; un producteur qui livrerait
 * « Company Name » tel quel ne déclencherait aucune erreur — il trouverait
 * simplement zéro champ, et l'import réussirait en ne remontant rien. Un échec
 * silencieux est le pire mode de défaillance pour ce module, d'où cette ligne.
 */
export type LinkedInRecords = {
  profile?: Record<string, string>[];
  positions?: Record<string, string>[];
  skills?: Record<string, string>[];
  education?: Record<string, string>[];
  recommendationsReceived?: Record<string, string>[];
  jobSeekerPreferences?: Record<string, string>[];
};

const MAX_POSITIONS = 30;
const MAX_EDUCATION = 15;
const MAX_SKILLS = 100;
const MAX_RECOMMENDATIONS = 10;
const MAX_TEXT_CHARS = 300_000;

/**
 * Le chemin de l'archive : les CSV sont décodés, puis on rejoint le tronc
 * commun. La signature publique ne change pas — tout ce qui appelait déjà
 * `buildCareerProfile` continue de marcher à l'identique.
 */
export function buildCareerProfile(files: LinkedInFiles): {
  text: string;
  skills: string[];
} {
  return buildCareerProfileFromRecords({
    profile: parseCsvRecords(files.profile ?? ""),
    positions: parseCsvRecords(files.positions ?? ""),
    skills: parseCsvRecords(files.skills ?? ""),
    education: parseCsvRecords(files.education ?? ""),
    recommendationsReceived: parseCsvRecords(
      files.recommendationsReceived ?? "",
    ),
    jobSeekerPreferences: parseCsvRecords(files.jobSeekerPreferences ?? ""),
  });
}

/**
 * Le tronc commun : construit le récit de parcours et la liste de compétences
 * déclarées. Seul ce que la source ÉNONCE réellement entre — un champ absent
 * est omis, jamais inventé. C'est ici que vivent les règles d'honnêteté, et
 * c'est pour cela que les deux chemins (archive et API) passent par cette
 * fonction et non chacun par le sien.
 */
export function buildCareerProfileFromRecords(records: LinkedInRecords): {
  text: string;
  skills: string[];
} {
  const lines: string[] = [];

  const profile = (records.profile ?? [])[0];
  if (profile) {
    const headline = field(profile, "Headline");
    const summary = field(profile, "Summary");
    const industry = field(profile, "Industry");
    if (headline) lines.push(headline);
    if (industry) lines.push(`Secteur : ${industry}`);
    if (summary) lines.push(`Résumé : ${summary}`);
  }

  const positions = (records.positions ?? []).slice(0, MAX_POSITIONS);
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

  const education = (records.education ?? []).slice(0, MAX_EDUCATION);
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

  // Recommendations received — kept ATTRIBUTED, never merged into the
  // narrative. They are the only text on a profile written by someone else,
  // which makes them the richest source of scope ("a piloté une équipe de
  // 12") and also the one thing the career reading must not quote as if the
  // person's own record had evidenced it. The label carries that distinction
  // into the dossier.
  const recommendations = (records.recommendationsReceived ?? [])
    .filter((r) => {
      // Pending or withdrawn recommendations are not visible on the profile
      // and may never have been accepted. Only what is actually published
      // counts as proof.
      const status = field(r, "Status").toUpperCase();
      return status === "" || status === "VISIBLE";
    })
    .slice(0, MAX_RECOMMENDATIONS);
  if (recommendations.length > 0) {
    lines.push("", "Recommandations reçues (écrites par des tiers) :");
    for (const r of recommendations) {
      const text = field(r, "Text", "Recommendation");
      if (!text) continue;
      const author = [field(r, "First Name"), field(r, "Last Name")]
        .filter(Boolean)
        .join(" ");
      const role = field(r, "Job Title", "Title");
      const company = field(r, "Company");
      const who = [
        author || null,
        role || null,
        company ? `chez ${company}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`- ${who ? `${who} : ` : ""}« ${text} »`);
    }
  }

  // Where the person projects themselves — the only signal in the whole export
  // that is about the NEXT rung rather than the last one.
  const preferences = (records.jobSeekerPreferences ?? [])[0];
  if (preferences) {
    const wanted = [
      [
        "Postes visés",
        field(preferences, "Job Titles", "Preferred Job Titles"),
      ],
      ["Lieux visés", field(preferences, "Locations", "Preferred Locations")],
      ["Secteurs visés", field(preferences, "Industries")],
      ["Types de poste", field(preferences, "Job Types", "Employment Types")],
      ["Taille d'entreprise", field(preferences, "Company Sizes")],
    ].filter(([, value]) => value !== "");
    if (wanted.length > 0) {
      lines.push("", "Ce que la personne vise (déclaré sur LinkedIn) :");
      for (const [label, value] of wanted) lines.push(`- ${label} : ${value}`);
    }
  }

  // Declared skills — de-duplicated, order preserved.
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const rec of records.skills ?? []) {
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
