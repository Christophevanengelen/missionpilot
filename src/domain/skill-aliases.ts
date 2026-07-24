/**
 * Skill normalization for the deterministic match (Phase 6 P4, ESCO-inspired).
 *
 * The bilingual (FR/EN) market surfaces the SAME skill under many forms —
 * acronyms ("JS" / "JavaScript"), spelling variants ("React.js" / "React"),
 * and translations ("gestion de projet" / "project management"). Comparing raw
 * lower-cased tokens misses those, undercounting a genuine match. This maps
 * each known surface form to a canonical key so the match score compares
 * like-for-like.
 *
 * Deliberately CONSERVATIVE: only exact equivalences (variants, acronyms,
 * translations) — never loose semantic clusters (e.g. "Salesforce" is a CRM
 * but is NOT aliased to "CRM"), which would fabricate matches and break the
 * honesty principle. Seeded from ESCO alternative-label patterns; the ESCO
 * API can enrich this later without changing the interface.
 */

/** canonical key → the surface forms that mean it (all lower-cased). */
const ALIAS_GROUPS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "java script"],
  typescript: ["ts"],
  react: ["react.js", "reactjs", "react js"],
  "react native": ["react-native"],
  "node.js": ["node", "nodejs", "node js"],
  "next.js": ["next", "nextjs", "next js"],
  "vue.js": ["vue", "vuejs"],
  kubernetes: ["k8s"],
  postgresql: ["postgres", "postgre", "psql"],
  mongodb: ["mongo"],
  "google cloud": ["gcp", "google cloud platform"],
  aws: ["amazon web services"],
  azure: ["ms azure", "microsoft azure"],
  // CI/CD (integration AND delivery/deployment) and Continuous Integration
  // (integration only) are kept DISTINCT — CI is a subset of CI/CD, not an
  // equivalence; folding them would inflate the score (honesty boundary).
  "ci/cd": ["cicd", "ci cd"],
  "continuous integration": ["intégration continue"],
  "machine learning": ["ml", "apprentissage automatique"],
  "artificial intelligence": ["ai", "ia", "intelligence artificielle"],
  "project management": ["gestion de projet", "gestion de projets"],
  "product management": ["gestion de produit", "gestion produit"],
  "user experience": ["ux", "expérience utilisateur"],
  "user interface": ["ui", "interface utilisateur"],
  "rest api": ["rest", "restful", "api rest"],
  devops: ["dev ops"],
  "site reliability engineering": ["sre", "site reliability"],
  "data engineering": ["ingénierie des données", "ingénierie data"],
  "data science": ["science des données"],
  agile: ["agilité", "méthode agile", "méthodes agiles"],
  "c#": ["c sharp", "csharp"],
  "c++": ["cpp", "c plus plus"],
  ".net": ["dotnet", "dot net"],
  go: ["golang"],
  "power bi": ["powerbi"],
};

/** Build the reverse lookup (surface form → canonical), once. */
const CANONICAL_BY_ALIAS = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(ALIAS_GROUPS)) {
  CANONICAL_BY_ALIAS.set(canonical, canonical);
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(alias, canonical);
}

/** Lower-case, trim, and collapse internal whitespace (a shared base with the
 *  score's own normalization). */
function normalizeSurface(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Canonicalize a skill token to a stable key for like-for-like comparison:
 * the known-alias mapping when there is one, otherwise the normalized surface
 * form. Pure and deterministic.
 */
export function canonicalizeSkill(raw: string): string {
  const surface = normalizeSurface(raw);
  return CANONICAL_BY_ALIAS.get(surface) ?? surface;
}
