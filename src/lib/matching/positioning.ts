/**
 * Deterministic market positioning (Phase 6 P11) — "where do I stand?".
 *
 * Built ONLY from the user's own legally-sourced opportunity corpus and their
 * validated profile: which skills the market (their own discovered offers)
 * asks for most, which of those they already evidence, and which they do not.
 * No AI, no external data, and — critically — no comparison against other
 * candidates (that data does not exist here and scraping it is out of bounds).
 *
 * Honesty: this describes DEMAND IN THE USER'S OWN CORPUS, not a ranking
 * against other people, and never a prediction. It is undecidable (⇒ null)
 * when there is not enough corpus to say anything.
 */
import { canonicalizeSkill } from "@/domain/skill-aliases";

/** Below this many offers carrying skills, any "market" claim is noise. */
export const MIN_OFFERS_FOR_POSITIONING = 3;
const TOP_SKILLS = 8;

export type DemandedSkill = {
  /** Display label — the most frequent original casing seen in the corpus. */
  label: string;
  /** How many offers in the corpus demand it. */
  offers: number;
  /** Share of the corpus offers demanding it (0-100, rounded). */
  share: number;
  /** True when the user's validated profile evidences it. */
  covered: boolean;
};

export type Positioning = {
  /** Offers (with at least one skill) the picture is built from. */
  corpusSize: number;
  /** Most-demanded skills first, capped — each flagged covered or not. */
  topSkills: DemandedSkill[];
  /** Share of the top demanded skills the profile covers (0-100). */
  coverage: number;
};

/**
 * Build the positioning picture, or `null` when the corpus is too small to
 * say anything honestly.
 */
export function buildPositioning(
  offers: { skills: string[] | null }[],
  profileSkills: string[],
): Positioning | null {
  const withSkills = offers.filter((o) => (o.skills ?? []).length > 0);
  if (withSkills.length < MIN_OFFERS_FOR_POSITIONING) return null;

  // Count each canonical skill ONCE per offer (a listing repeating a skill
  // must not inflate demand), keeping the most common original casing.
  const offerCount = new Map<string, number>();
  const labelCounts = new Map<string, Map<string, number>>();
  for (const offer of withSkills) {
    const seen = new Set<string>();
    for (const raw of offer.skills ?? []) {
      const key = canonicalizeSkill(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      offerCount.set(key, (offerCount.get(key) ?? 0) + 1);
      const labels = labelCounts.get(key) ?? new Map<string, number>();
      const label = raw.trim();
      labels.set(label, (labels.get(label) ?? 0) + 1);
      labelCounts.set(key, labels);
    }
  }
  if (offerCount.size === 0) return null;

  const have = new Set(profileSkills.map(canonicalizeSkill).filter(Boolean));

  const topSkills = [...offerCount.entries()]
    // Most demanded first; ties resolved alphabetically for a stable order.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_SKILLS)
    .map(([key, count]) => {
      const labels = labelCounts.get(key)!;
      const label = [...labels.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0][0];
      return {
        label,
        offers: count,
        share: Math.round((100 * count) / withSkills.length),
        covered: have.has(key),
      };
    });

  const covered = topSkills.filter((s) => s.covered).length;
  return {
    corpusSize: withSkills.length,
    topSkills,
    coverage: Math.round((100 * covered) / topSkills.length),
  };
}
