/**
 * Version snapshot building, canonicalization and hashing.
 *
 * A published version embeds a NORMALIZED snapshot of the confirmed claims
 * AND the relevant evidence fields — never bare ids pointing at the living
 * library — so later library edits cannot rewrite an old version's meaning.
 *
 * The business hash covers a canonical form that EXCLUDES visual order,
 * technical timestamps and meaningless identifiers: claims and evidence are
 * sorted deterministically, object keys are sorted recursively, and
 * `evidence_id` (kept in the content for restore re-linking) is stripped
 * before hashing.
 */
import { createHash } from "node:crypto";

export const VERSION_CONTENT_SCHEMA_VERSION = 1;

export type SnapshotEvidence = {
  /** Kept for restore re-linking; excluded from the business hash. */
  evidence_id: string;
  type: string;
  title: string;
  statement: string;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  verification_status: string;
  source_type: string;
  source_reference: string | null;
};

export type SnapshotClaim = {
  kind: string;
  value: Record<string, unknown>;
  evidence: SnapshotEvidence[];
};

export type VersionContent = {
  schema_version: number;
  claims: SnapshotClaim[];
};

type ClaimRow = {
  id: string;
  kind: string;
  value: Record<string, unknown>;
};

type EvidenceRow = {
  id: string;
  type: string;
  title: string;
  statement: string;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  verification_status: string;
  source_type: string;
  source_reference: string | null;
};

type LinkRow = { claim_id: string; evidence_id: string };

/** Stable canonical JSON: keys sorted recursively, no whitespace games. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",")}}`;
}

function sortSnapshot(content: VersionContent): VersionContent {
  const claims = [...content.claims]
    .map((c) => ({
      ...c,
      // Total order over the FULL embedded record (id stripped): equal
      // business content must canonicalize identically whatever the DB row
      // order — the hash-determinism guarantee depends on it.
      evidence: [...c.evidence].sort((a, b) => {
        const ka = canonicalJson({ ...a, evidence_id: undefined });
        const kb = canonicalJson({ ...b, evidence_id: undefined });
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      }),
    }))
    .sort((a, b) => {
      const ka = `${a.kind} ${canonicalJson(a.value)}`;
      const kb = `${b.kind} ${canonicalJson(b.value)}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return { schema_version: content.schema_version, claims };
}

/** Build the normalized snapshot from confirmed claims + ACTIVE links. */
export function buildVersionContent(
  claims: ClaimRow[],
  links: LinkRow[],
  evidence: EvidenceRow[],
): VersionContent {
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const content: VersionContent = {
    schema_version: VERSION_CONTENT_SCHEMA_VERSION,
    claims: claims.map((claim) => ({
      kind: claim.kind,
      value: claim.value,
      evidence: links
        .filter((l) => l.claim_id === claim.id)
        .flatMap((l) => {
          const e = evidenceById.get(l.evidence_id);
          if (!e) return [];
          return [
            {
              evidence_id: e.id,
              type: e.type,
              title: e.title,
              statement: e.statement,
              organization: e.organization,
              start_date: e.start_date,
              end_date: e.end_date,
              verification_status: e.verification_status,
              source_type: e.source_type,
              source_reference: e.source_reference,
            },
          ];
        }),
    })),
  };
  return sortSnapshot(content);
}

/** Canonical form for hashing: sorted + evidence ids stripped. */
export function canonicalForHash(content: VersionContent): string {
  const sorted = sortSnapshot(content);
  const stripped = {
    schema_version: sorted.schema_version,
    claims: sorted.claims.map((c) => ({
      kind: c.kind,
      value: c.value,
      evidence: c.evidence.map((e) => {
        const rest: Record<string, unknown> = { ...e };
        delete rest.evidence_id;
        return rest;
      }),
    })),
  };
  return canonicalJson(stripped);
}

export function contentHash(content: VersionContent): string {
  return createHash("sha256").update(canonicalForHash(content)).digest("hex");
}
