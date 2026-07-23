import { describe, expect, it } from "vitest";
import { diffVersions } from "@/lib/profile/version-diff";
import type {
  SnapshotClaim,
  SnapshotEvidence,
  VersionContent,
} from "@/lib/profile/version-content";

function evidence(
  id: string,
  overrides: Partial<SnapshotEvidence> = {},
): SnapshotEvidence {
  return {
    evidence_id: id,
    type: "achievement",
    title: "Migration design system",
    statement: "Migration menée sur 4 produits.",
    organization: null,
    role_played: null,
    start_date: null,
    end_date: null,
    verification_status: "user_confirmed",
    source_type: "user_stated",
    source_reference: null,
    ...overrides,
  };
}

function claim(
  kind: string,
  value: Record<string, unknown>,
  ev: SnapshotEvidence[] = [],
): SnapshotClaim {
  return { kind, value, evidence: ev };
}

function content(claims: SnapshotClaim[]): VersionContent {
  return { schema_version: 1, claims };
}

const role = (title: string) => claim("role", { title });
const skill = (name: string) => claim("skill", { name });

describe("diffVersions", () => {
  it("identical snapshots yield zero changes and only unchanged entries", () => {
    const a = content([role("Product Designer"), skill("Figma")]);
    const b = content([role("Product Designer"), skill("Figma")]);
    const diff = diffVersions(a, b);
    expect(diff.counts).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(diff.entries.map((e) => e.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
  });

  it("a new collection value is a single added entry", () => {
    const diff = diffVersions(
      content([role("PD")]),
      content([role("PD"), skill("Figma")]),
    );
    expect(diff.counts).toEqual({ added: 1, modified: 0, removed: 0 });
    const added = diff.entries.find((e) => e.status === "added");
    expect(added?.kind).toBe("skill");
    expect(added?.before).toBeNull();
    expect(added?.after?.value).toEqual({ name: "Figma" });
  });

  it("a missing collection value is a single removed entry", () => {
    const diff = diffVersions(
      content([role("PD"), skill("Sketch")]),
      content([role("PD")]),
    );
    expect(diff.counts).toEqual({ added: 0, modified: 0, removed: 1 });
    const removed = diff.entries.find((e) => e.status === "removed");
    expect(removed?.before?.value).toEqual({ name: "Sketch" });
    expect(removed?.after).toBeNull();
  });

  it("a changed single-valued field is one modified entry with before/after", () => {
    const diff = diffVersions(
      content([role("Senior UX/UI Designer")]),
      content([role("Senior UX Strategist & Service Designer")]),
    );
    expect(diff.counts).toEqual({ added: 0, modified: 1, removed: 0 });
    const m = diff.entries[0];
    expect(m.status).toBe("modified");
    expect(m.before?.value).toEqual({ title: "Senior UX/UI Designer" });
    expect(m.after?.value).toEqual({
      title: "Senior UX Strategist & Service Designer",
    });
  });

  it("a single-valued kind appearing or disappearing is added/removed, not modified", () => {
    const appears = diffVersions(
      content([role("PD")]),
      content([
        role("PD"),
        claim("summary", { text: "Quinze ans de design." }),
      ]),
    );
    expect(appears.counts).toEqual({ added: 1, modified: 0, removed: 0 });

    const disappears = diffVersions(
      content([role("PD"), claim("summary", { text: "" })]),
      content([role("PD")]),
    );
    expect(disappears.counts).toEqual({ added: 0, modified: 0, removed: 1 });
    expect(
      disappears.entries.find((e) => e.status === "removed")?.before?.value,
    ).toEqual({ text: "" });
  });

  it("a reworded collection value is honestly one removed + one added", () => {
    const diff = diffVersions(
      content([skill("Design system")]),
      content([skill("Design system Figma")]),
    );
    expect(diff.counts).toEqual({ added: 1, modified: 0, removed: 1 });
    expect(diff.entries.map((e) => e.status).sort()).toEqual([
      "added",
      "removed",
    ]);
  });

  it("an order-only difference produces no change", () => {
    const diff = diffVersions(
      content([skill("Figma"), skill("Recherche utilisateur"), role("PD")]),
      content([role("PD"), skill("Recherche utilisateur"), skill("Figma")]),
    );
    expect(diff.counts).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(diff.entries.every((e) => e.status === "unchanged")).toBe(true);
  });

  it("evidence content changed under the same evidence_id makes the claim modified", () => {
    const before = content([
      claim("achievement", { title: "Refonte" }, [evidence("ev-1")]),
    ]);
    const after = content([
      claim("achievement", { title: "Refonte" }, [
        evidence("ev-1", { statement: "Refonte livrée en 6 mois." }),
      ]),
    ]);
    const diff = diffVersions(before, after);
    expect(diff.counts).toEqual({ added: 0, modified: 1, removed: 0 });
    const m = diff.entries[0];
    expect(m.status).toBe("modified");
    expect(m.evidenceChanges?.changed).toHaveLength(1);
    expect(m.evidenceChanges?.changed[0].after.statement).toBe(
      "Refonte livrée en 6 mois.",
    );
  });

  it("evidence attached or detached makes the owning claim modified — no extra profile entry", () => {
    const before = content([claim("achievement", { title: "Refonte" }, [])]);
    const after = content([
      claim("achievement", { title: "Refonte" }, [evidence("ev-1")]),
    ]);
    const diff = diffVersions(before, after);
    expect(diff.entries).toHaveLength(1);
    expect(diff.counts).toEqual({ added: 0, modified: 1, removed: 0 });
    expect(diff.entries[0].evidenceChanges?.added).toHaveLength(1);

    const reverse = diffVersions(after, before);
    expect(reverse.entries).toHaveLength(1);
    expect(reverse.counts).toEqual({ added: 0, modified: 1, removed: 0 });
    expect(reverse.entries[0].evidenceChanges?.removed).toHaveLength(1);
  });

  it("duplicate collection values pair up; the surplus occurrence is one removal", () => {
    const diff = diffVersions(
      content([skill("React"), skill("React")]),
      content([skill("React")]),
    );
    expect(diff.counts).toEqual({ added: 0, modified: 0, removed: 1 });
    expect(diff.entries.filter((e) => e.status === "unchanged")).toHaveLength(
      1,
    );
  });

  it("counts derive exactly from entries", () => {
    const diff = diffVersions(
      content([role("A"), skill("X"), skill("Y")]),
      content([role("B"), skill("Y"), skill("Z")]),
    );
    const fromEntries = { added: 0, modified: 0, removed: 0 };
    for (const e of diff.entries) {
      if (e.status !== "unchanged") {
        fromEntries[e.status] += 1;
      }
    }
    expect(diff.counts).toEqual(fromEntries);
    expect(diff.counts).toEqual({ added: 1, modified: 1, removed: 1 });
  });

  it("empty snapshots on either side stay coherent", () => {
    const empty = content([]);
    const one = content([role("PD")]);
    expect(diffVersions(empty, empty).entries).toHaveLength(0);
    expect(diffVersions(empty, one).counts).toEqual({
      added: 1,
      modified: 0,
      removed: 0,
    });
    expect(diffVersions(one, empty).counts).toEqual({
      added: 0,
      modified: 0,
      removed: 1,
    });
  });
});
