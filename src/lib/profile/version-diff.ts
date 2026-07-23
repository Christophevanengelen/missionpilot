/**
 * Pure business-level comparison of two version snapshots.
 *
 * Identity rules (owner-confirmed):
 *  - single-valued kinds are compared by `kind`;
 *  - evidence is compared by `evidence_id`, using ONLY the content embedded
 *    in each snapshot (never the current mutable evidence state);
 *  - collections without a stable id (skills, achievements) are compared by
 *    canonical value — a reworded value is honestly one `removed` + one
 *    `added`, never an inferred "modification";
 *  - an order-only difference produces no change (snapshots are canonical).
 *
 * Evidence added/removed/content-changed makes the OWNING claim `modified`
 * (details attached to that entry — no separate profile entry). `counts`
 * derive exclusively from `entries`.
 */
import { SINGLE_VALUED_KINDS } from "@/domain/profile";
import { FOUNDATION_ORDER } from "./interview";
import {
  canonicalJson,
  type SnapshotClaim,
  type SnapshotEvidence,
  type VersionContent,
} from "./version-content";

export type DiffStatus = "added" | "modified" | "removed" | "unchanged";

export type EvidenceChanges = {
  added: SnapshotEvidence[];
  removed: SnapshotEvidence[];
  /** Same evidence_id in both snapshots, different embedded content. */
  changed: { before: SnapshotEvidence; after: SnapshotEvidence }[];
};

export type DiffEntry = {
  status: DiffStatus;
  kind: string;
  /** Snapshot claim as embedded in each version (null when absent). */
  before: SnapshotClaim | null;
  after: SnapshotClaim | null;
  /** Present on `modified` entries whose evidence sets differ. */
  evidenceChanges?: EvidenceChanges;
};

export type DiffCounts = { added: number; modified: number; removed: number };

export type VersionDiff = { entries: DiffEntry[]; counts: DiffCounts };

/** Embedded content comparison, id excluded (identity is the id itself). */
function evidenceContentKey(e: SnapshotEvidence): string {
  const rest: Record<string, unknown> = { ...e };
  delete rest.evidence_id;
  return canonicalJson(rest);
}

function diffEvidence(
  before: SnapshotEvidence[],
  after: SnapshotEvidence[],
): EvidenceChanges | undefined {
  const beforeById = new Map(before.map((e) => [e.evidence_id, e]));
  const afterById = new Map(after.map((e) => [e.evidence_id, e]));
  const changes: EvidenceChanges = { added: [], removed: [], changed: [] };
  for (const e of before) {
    const now = afterById.get(e.evidence_id);
    if (!now) changes.removed.push(e);
    else if (evidenceContentKey(now) !== evidenceContentKey(e)) {
      changes.changed.push({ before: e, after: now });
    }
  }
  for (const e of after) {
    if (!beforeById.has(e.evidence_id)) changes.added.push(e);
  }
  return changes.added.length ||
    changes.removed.length ||
    changes.changed.length
    ? changes
    : undefined;
}

function claimEntry(
  kind: string,
  before: SnapshotClaim | null,
  after: SnapshotClaim | null,
): DiffEntry {
  if (before && !after) return { status: "removed", kind, before, after: null };
  if (!before && after) return { status: "added", kind, before: null, after };
  if (!before || !after) throw new Error("unreachable: both sides absent");
  const valueChanged =
    canonicalJson(before.value) !== canonicalJson(after.value);
  const evidenceChanges = diffEvidence(before.evidence, after.evidence);
  if (!valueChanged && !evidenceChanges) {
    return { status: "unchanged", kind, before, after };
  }
  return { status: "modified", kind, before, after, evidenceChanges };
}

/** Stable kind order: the existing business order, unknown kinds last. */
function kindRank(kind: string): number {
  const i = (FOUNDATION_ORDER as readonly string[]).indexOf(kind);
  return i === -1 ? FOUNDATION_ORDER.length : i;
}

export function diffVersions(
  before: VersionContent,
  after: VersionContent,
): VersionDiff {
  const entries: DiffEntry[] = [];
  const kinds = [
    ...new Set([...before.claims, ...after.claims].map((c) => c.kind)),
  ].sort((a, b) => kindRank(a) - kindRank(b) || (a < b ? -1 : a > b ? 1 : 0));

  for (const kind of kinds) {
    const beforeClaims = before.claims.filter((c) => c.kind === kind);
    const afterClaims = after.claims.filter((c) => c.kind === kind);

    if ((SINGLE_VALUED_KINDS as readonly string[]).includes(kind)) {
      entries.push(
        claimEntry(kind, beforeClaims[0] ?? null, afterClaims[0] ?? null),
      );
      continue;
    }

    // Collections: group by canonical value. Duplicates (no uniqueness
    // constraint exists on multi-valued values) pair up positionally within
    // a value group; surplus occurrences are honest adds/removals. Accepted
    // simplification: the snapshot sort keys on (kind, value), so the order
    // AMONG identical-value duplicates is unspecified — pairing may match
    // their evidence sets arbitrarily in that rare case.
    const byValue = new Map<
      string,
      { before: SnapshotClaim[]; after: SnapshotClaim[] }
    >();
    for (const c of beforeClaims) {
      const key = canonicalJson(c.value);
      const g = byValue.get(key) ?? { before: [], after: [] };
      g.before.push(c);
      byValue.set(key, g);
    }
    for (const c of afterClaims) {
      const key = canonicalJson(c.value);
      const g = byValue.get(key) ?? { before: [], after: [] };
      g.after.push(c);
      byValue.set(key, g);
    }
    const orderedKeys = [...byValue.keys()].sort();
    for (const key of orderedKeys) {
      const g = byValue.get(key)!;
      const pairs = Math.min(g.before.length, g.after.length);
      for (let i = 0; i < pairs; i += 1) {
        entries.push(claimEntry(kind, g.before[i], g.after[i]));
      }
      for (let i = pairs; i < g.before.length; i += 1) {
        entries.push(claimEntry(kind, g.before[i], null));
      }
      for (let i = pairs; i < g.after.length; i += 1) {
        entries.push(claimEntry(kind, null, g.after[i]));
      }
    }
  }

  const counts: DiffCounts = { added: 0, modified: 0, removed: 0 };
  for (const e of entries) {
    if (e.status !== "unchanged") counts[e.status] += 1;
  }
  return { entries, counts };
}
