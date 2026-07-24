/**
 * Onboarding summary — the pure decision behind the dashboard's two faces
 * (owner mandate: "il n'y a plus qu'à découvrir le résultat après un upload
 * de CV"). First login = a profile with nothing confirmed ⇒ the CV hero.
 * Once a role or a skill is confirmed ⇒ the status view (profile + offers).
 *
 * No I/O here so the branch is unit-testable; the page passes it the living
 * claims and the already-loaded counts.
 */

export type OnboardingSummary = {
  /** True once the user has confirmed a role OR at least one skill — the
   *  signal that they are past the empty first-login state. */
  hasProfile: boolean;
  /** The confirmed priority role title, when there is one. */
  roleTitle: string | null;
  /** How many skills the user has confirmed. */
  confirmedSkills: number;
  /** Target métiers driving discovery (validated preferences). */
  targetRoles: string[];
  /** Opportunities the user owns. */
  opportunities: number;
  /** Opportunities carrying an AI "pourquoi ce match" insight. */
  analyzed: number;
};

export function summarizeOnboarding(
  claims: { kind: string; state: string; value: unknown }[],
  opportunities: number,
  analyzed: number,
  targetRoles: string[],
): OnboardingSummary {
  const confirmed = claims.filter((c) => c.state === "confirmed");
  const roleTitle =
    confirmed
      .filter((c) => c.kind === "role")
      .map((c) => (c.value as { title?: unknown })?.title)
      .find((v): v is string => typeof v === "string" && v.trim() !== "") ??
    null;
  const confirmedSkills = confirmed.filter((c) => c.kind === "skill").length;
  return {
    hasProfile: roleTitle !== null || confirmedSkills > 0,
    roleTitle,
    confirmedSkills,
    targetRoles: targetRoles.filter((t) => t.trim() !== ""),
    opportunities,
    analyzed,
  };
}
