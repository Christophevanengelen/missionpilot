import { describe, expect, it } from "vitest";
import {
  dueFollowUps,
  groupByStage,
  isTrackingStage,
  TRACKING_STAGES,
  type TrackedOpportunity,
} from "@/lib/tracking/logic";

const item = (
  opportunityId: string,
  stage: TrackedOpportunity["stage"],
  followUpOn: string | null = null,
): TrackedOpportunity => ({
  opportunityId,
  stage,
  note: "",
  followUpOn,
  title: opportunityId,
  organization: null,
  updatedAt: "2026-07-24T00:00:00Z",
});

describe("isTrackingStage", () => {
  it("accepts the six pipeline stages and rejects anything else", () => {
    for (const s of TRACKING_STAGES) expect(isTrackingStage(s)).toBe(true);
    expect(isTrackingStage("archived")).toBe(false);
    expect(isTrackingStage(null)).toBe(false);
    expect(isTrackingStage(3)).toBe(false);
  });
});

describe("groupByStage", () => {
  it("buckets by stage, every column present (even empty), stage order kept", () => {
    const groups = groupByStage([
      item("a", "applied"),
      item("b", "saved"),
      item("c", "applied"),
    ]);
    expect(Object.keys(groups)).toEqual([...TRACKING_STAGES]);
    expect(groups.applied.map((x) => x.opportunityId)).toEqual(["a", "c"]);
    expect(groups.saved.map((x) => x.opportunityId)).toEqual(["b"]);
    expect(groups.interview).toEqual([]);
  });
});

describe("dueFollowUps", () => {
  it("returns follow-ups due on or before today, soonest first", () => {
    const due = dueFollowUps(
      [
        item("past", "applied", "2026-07-20"),
        item("today", "interview", "2026-07-24"),
        item("future", "applied", "2026-08-01"),
        item("none", "saved", null),
      ],
      "2026-07-24",
    );
    expect(due.map((d) => d.opportunityId)).toEqual(["past", "today"]);
  });

  it("is empty when nothing is due", () => {
    expect(
      dueFollowUps([item("x", "applied", "2026-09-01")], "2026-07-24"),
    ).toEqual([]);
  });
});
