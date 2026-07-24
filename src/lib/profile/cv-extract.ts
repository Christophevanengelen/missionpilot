/**
 * Deterministic skill detection from CV text. Pure and framework-free — no I/O,
 * no LLM. It only ever proposes skills from the curated taxonomy (never
 * invents one), and the user confirms what is real. A later, cost-gated LLM
 * brick reads free-form experience beyond this baseline.
 */
import { SKILLS_TAXONOMY } from "@/domain/skills-taxonomy";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, Unicode word-boundary match — so "Go" matches "Go" / "Go-"
 * but not "Django", and "React" is found in "React.js". Punctuation in a term
 * (C#, C++, Node.js, CI/CD) is treated literally. A "." immediately BEFORE the
 * term is NOT a boundary: in "Node.js" the ".js" is an extension-style suffix
 * of another term, and must not trigger the "js" alias (a false JavaScript
 * detection). A "." after the term stays a boundary ("React" in "React.js").
 */
function matchesTerm(haystack: string, term: string): boolean {
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}.])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`,
    "iu",
  );
  return re.test(haystack);
}

/**
 * Canonical skills whose name or an alias appears in the text. De-duplicated,
 * in taxonomy order. Honest: only taxonomy skills, never fabricated.
 */
export function detectSkills(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const entry of SKILLS_TAXONOMY) {
    const terms = [entry.name, ...(entry.aliases ?? [])];
    if (terms.some((term) => matchesTerm(text, term))) {
      found.push(entry.name);
    }
  }
  return found;
}
