/**
 * Deterministic French change summary between two version contents.
 * Pure code, no AI: the user must understand in plain language what changes
 * before confirming a new version. Reference cases are unit-tested.
 */
import { canonicalJson, type VersionContent } from "./version-content";

type SingleValued = "role" | "seniority" | "summary" | "years_experience";

const SINGLE_LABELS: Record<SingleValued, string> = {
  role: "Rôle",
  seniority: "Séniorité",
  summary: "Résumé",
  years_experience: "Années d'expérience",
};

function singleValue(content: VersionContent, kind: SingleValued) {
  const claim = content.claims.find((c) => c.kind === kind);
  return claim ? canonicalJson(claim.value) : null;
}

function multiSet(content: VersionContent, kind: "skill" | "achievement") {
  return new Set(
    content.claims
      .filter((c) => c.kind === kind)
      .map((c) => canonicalJson(c.value)),
  );
}

function evidenceCount(content: VersionContent): number {
  return content.claims.reduce((n, c) => n + c.evidence.length, 0);
}

function stripEvidenceId(e: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...e };
  delete rest.evidence_id;
  return rest;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export function buildChangeSummary(
  previous: VersionContent | null,
  next: VersionContent,
): string {
  if (!previous) {
    return "Première version publiée du profil.";
  }

  const parts: string[] = [];

  for (const kind of Object.keys(SINGLE_LABELS) as SingleValued[]) {
    const before = singleValue(previous, kind);
    const after = singleValue(next, kind);
    if (before === after) continue;
    if (before === null) parts.push(`${SINGLE_LABELS[kind]} renseigné`);
    else if (after === null) parts.push(`${SINGLE_LABELS[kind]} retiré`);
    else parts.push(`${SINGLE_LABELS[kind]} mis à jour`);
  }

  for (const [kind, singular, pluralForm, removedS, removedP] of [
    [
      "skill",
      "compétence ajoutée",
      "compétences ajoutées",
      "compétence retirée",
      "compétences retirées",
    ],
    [
      "achievement",
      "réalisation ajoutée",
      "réalisations ajoutées",
      "réalisation retirée",
      "réalisations retirées",
    ],
  ] as const) {
    const before = multiSet(previous, kind);
    const after = multiSet(next, kind);
    const added = [...after].filter((v) => !before.has(v)).length;
    const removed = [...before].filter((v) => !after.has(v)).length;
    if (added > 0) parts.push(plural(added, singular, pluralForm));
    if (removed > 0) parts.push(plural(removed, removedS, removedP));
  }

  const evidenceDelta = evidenceCount(next) - evidenceCount(previous);
  if (evidenceDelta > 0) {
    parts.push(plural(evidenceDelta, "preuve rattachée", "preuves rattachées"));
  } else if (evidenceDelta < 0) {
    parts.push(plural(-evidenceDelta, "preuve détachée", "preuves détachées"));
  }

  if (parts.length === 0) {
    // Same claims and same evidence counts, yet something differs: the
    // CONTENT of an attached evidence changed (title, statement,
    // verification…). Say so honestly instead of "no change".
    const evidenceChanged =
      canonicalJson(
        previous.claims.map((c) => c.evidence.map(stripEvidenceId)),
      ) !==
      canonicalJson(next.claims.map((c) => c.evidence.map(stripEvidenceId)));
    return evidenceChanged
      ? "Preuves rattachées mises à jour."
      : "Aucun changement de fond.";
  }

  const summary = parts.join(" · ");
  return summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
}

export function buildRestoreSummary(versionNumber: number): string {
  return `Restauration de la version ${versionNumber}.`;
}
