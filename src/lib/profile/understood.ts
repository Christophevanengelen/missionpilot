import type { ClaimKind } from "@/domain/profile";

/**
 * What we understood, said back before anything is asked.
 *
 * The failure this exists to prevent: someone drops their CV, we read it, and
 * the next screen shows them the drop zone again. They did the work and nothing
 * moved — which teaches, in one interaction, that their effort does not reach
 * us. Restitution is what makes the questions that follow feel earned rather
 * than bureaucratic.
 *
 * Pure and total: it reads whatever the claims happen to hold and never throws
 * on a shape it did not expect. A malformed claim is reported as *not known*
 * rather than crashing the only screen the product has — and "not known" is
 * exactly the honest reading, since we cannot say what we could not parse.
 */

export type UnderstoodLine = {
  kind: ClaimKind;
  /** The label shown to the person, in their language. */
  label: string;
  /** What we understood, or null when the CV did not say. */
  value: string | null;
};

export type Understood = {
  lines: UnderstoodLine[];
  skills: string[];
  /**
   * Nothing at all is known — not one confirmed claim.
   *
   * This is the ONLY state where the drop zone is the whole screen. Once a
   * single fact exists, the screen owes the person a reflection of it.
   */
  empty: boolean;
};

export type ConfirmedClaim = { kind: string; value: unknown };

/** Reads one string field out of a claim value without trusting its shape. */
function field(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = (value as Record<string, unknown>)[key];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}

function firstOf(
  claims: readonly ConfirmedClaim[],
  kind: ClaimKind,
  key: string,
): string | null {
  for (const claim of claims) {
    if (claim.kind !== kind) continue;
    const read = field(claim.value, key);
    if (read !== null) return read;
  }
  return null;
}

/**
 * Skill names, de-duplicated case-insensitively, in the order they were
 * confirmed. Order is the user's own: the first thing they kept is the first
 * thing they see.
 */
function skillNames(claims: readonly ConfirmedClaim[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const claim of claims) {
    if (claim.kind !== "skill") continue;
    const name = field(claim.value, "name");
    if (name === null) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function summariseUnderstanding(
  claims: readonly ConfirmedClaim[],
): Understood {
  const years = firstOf(claims, "years_experience", "years");
  const lines: UnderstoodLine[] = [
    {
      kind: "role",
      label: "Votre métier",
      value: firstOf(claims, "role", "title"),
    },
    {
      kind: "seniority",
      label: "Votre niveau",
      value: firstOf(claims, "seniority", "level"),
    },
    {
      kind: "years_experience",
      label: "Votre expérience",
      value: years === null ? null : `${years} ans`,
    },
  ];
  const skills = skillNames(claims);
  return {
    lines,
    skills,
    // A claim whose value we could not read is not knowledge. Emptiness is
    // measured on what we can actually say back, never on the row count.
    empty: lines.every((l) => l.value === null) && skills.length === 0,
  };
}
