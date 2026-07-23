import { describe, expect, it } from "vitest";
import {
  buildVersionContent,
  canonicalForHash,
  canonicalJson,
  contentHash,
  type VersionContent,
} from "@/lib/profile/version-content";

const evidenceA = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  type: "achievement",
  title: "Refonte du checkout",
  statement: "+18 % de conversion",
  organization: "Acme",
  start_date: "2023-01-01",
  end_date: "2024-01-01",
  verification_status: "user_confirmed",
  source_type: "user_stated",
  source_reference: null,
};

const claimRole = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "role",
  value: { title: "Product Designer" },
};
const claimSkill = {
  id: "22222222-2222-2222-2222-222222222222",
  kind: "skill",
  value: { name: "UX" },
};

describe("canonicalJson", () => {
  it("sorts object keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 }, e: undefined })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });
});

describe("version content + hash", () => {
  it("is insensitive to input order (visual order excluded from hash)", () => {
    const forward = buildVersionContent(
      [claimRole, claimSkill],
      [{ claim_id: claimRole.id, evidence_id: evidenceA.id }],
      [evidenceA],
    );
    const backward = buildVersionContent(
      [claimSkill, claimRole],
      [{ claim_id: claimRole.id, evidence_id: evidenceA.id }],
      [evidenceA],
    );
    expect(contentHash(forward)).toBe(contentHash(backward));
    expect(forward).toEqual(backward);
  });

  it("keeps evidence_id in the content but excludes it from the hash", () => {
    const content = buildVersionContent(
      [claimRole],
      [{ claim_id: claimRole.id, evidence_id: evidenceA.id }],
      [evidenceA],
    );
    expect(content.claims[0].evidence[0].evidence_id).toBe(evidenceA.id);
    expect(canonicalForHash(content)).not.toContain(evidenceA.id);

    const renamedId = buildVersionContent(
      [claimRole],
      [
        {
          claim_id: claimRole.id,
          evidence_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
      ],
      [{ ...evidenceA, id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }],
    );
    expect(contentHash(renamedId)).toBe(contentHash(content));
  });

  it("orders equal-title evidence deterministically (total order)", () => {
    // Two evidence sharing title+statement but differing elsewhere: whatever
    // the input order, the canonical form is identical.
    const twin = {
      ...evidenceA,
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      organization: "Globex",
    };
    const links = [
      { claim_id: claimRole.id, evidence_id: evidenceA.id },
      { claim_id: claimRole.id, evidence_id: twin.id },
    ];
    const ab = buildVersionContent([claimRole], links, [evidenceA, twin]);
    const ba = buildVersionContent([claimRole], [...links].reverse(), [
      twin,
      evidenceA,
    ]);
    expect(contentHash(ab)).toBe(contentHash(ba));
    expect(canonicalForHash(ab)).toBe(canonicalForHash(ba));
  });

  it("changes when business content changes", () => {
    const a = buildVersionContent([claimRole], [], []);
    const b = buildVersionContent(
      [{ ...claimRole, value: { title: "Lead Product Designer" } }],
      [],
      [],
    );
    expect(contentHash(a)).not.toBe(contentHash(b));
  });

  it("matches the frozen reference vector (canonicalization contract)", () => {
    const content: VersionContent = buildVersionContent([claimRole], [], []);
    expect(canonicalForHash(content)).toBe(
      '{"claims":[{"evidence":[],"kind":"role","value":{"title":"Product Designer"}}],"schema_version":1}',
    );
    expect(contentHash(content)).toMatch(/^[0-9a-f]{64}$/);
  });
});
