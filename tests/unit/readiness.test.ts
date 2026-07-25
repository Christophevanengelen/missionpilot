import { describe, expect, it } from "vitest";
import {
  DIGEST_THRESHOLD,
  SEARCH_THRESHOLD,
  assessReadiness,
  nextStep,
  type ReadinessInput,
} from "@/lib/profile/readiness";

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    confirmedClaims: [],
    preferences: {
      targetRoleFamilies: [],
      allowedWorkRegions: [],
      preferredEngagementTypes: [],
      remotePolicy: null,
    },
    testimonialCount: 0,
    openTrajectoryQuestions: 3,
    ...over,
  };
}

const claims = (kind: string, n = 1) =>
  Array.from({ length: n }, () => ({ kind, value: {} }));

const FULL_IDENTITY = [
  ...claims("role"),
  ...claims("seniority"),
  ...claims("years_experience"),
];

describe("assessReadiness", () => {
  it("scores an empty profile at zero and asks for nothing impossible", () => {
    const r = assessReadiness(input());
    expect(r.score).toBe(0);
    expect(r.canSearch).toBe(false);
    expect(r.canDigest).toBe(false);
  });

  it("scores a complete profile at 100", () => {
    const r = assessReadiness(
      input({
        confirmedClaims: [...FULL_IDENTITY, ...claims("skill", 5)],
        preferences: {
          targetRoleFamilies: ["Service Designer"],
          allowedWorkRegions: ["Belgique"],
          preferredEngagementTypes: ["freelance"],
          remotePolicy: "remote_first",
        },
        testimonialCount: 2,
        openTrajectoryQuestions: 0,
      }),
    );
    expect(r.score).toBe(100);
    expect(r.canSearch).toBe(true);
    expect(r.canDigest).toBe(true);
  });

  it("refuses to search on scope alone", () => {
    // Filters over an empty profile return a tidy list of irrelevance.
    const r = assessReadiness(
      input({
        preferences: {
          targetRoleFamilies: ["X"],
          allowedWorkRegions: ["Y"],
          preferredEngagementTypes: ["freelance"],
          remotePolicy: "onsite_ok",
        },
        testimonialCount: 2,
        openTrajectoryQuestions: 0,
      }),
    );
    expect(r.canSearch).toBe(false);
  });

  it("opens the search well before the profile is perfect", () => {
    // Waiting for a perfect profile would hide the product behind a form, and
    // the first result is what makes someone want to finish the rest.
    const r = assessReadiness(
      input({
        confirmedClaims: [...FULL_IDENTITY, ...claims("skill", 5)],
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(SEARCH_THRESHOLD);
    expect(r.canSearch).toBe(true);
    expect(r.canDigest).toBe(false);
  });

  it("holds the digest to a higher bar than the search", () => {
    // A search that disappoints costs a click; an email that disappoints
    // trains someone to ignore us, and there is no second chance at that.
    expect(DIGEST_THRESHOLD).toBeGreaterThan(SEARCH_THRESHOLD);
  });

  it("treats each unanswered career question as one unit of gap", () => {
    const two = assessReadiness(input({ openTrajectoryQuestions: 2 }));
    const none = assessReadiness(input({ openTrajectoryQuestions: 0 }));
    expect(none.score).toBeGreaterThan(two.score);
  });

  it("counts partial skills proportionally rather than all-or-nothing", () => {
    const some = assessReadiness(
      input({ confirmedClaims: claims("skill", 2) }),
    );
    const more = assessReadiness(
      input({ confirmedClaims: claims("skill", 4) }),
    );
    expect(more.score).toBeGreaterThan(some.score);
  });
});

describe("nextStep", () => {
  it("asks the heaviest gap first — the answer that buys the most", () => {
    const r = assessReadiness(input({ confirmedClaims: claims("skill", 5) }));
    expect(nextStep(r)?.dimension).toBe("identity");
  });

  it("asks one thing at a time — a list of gaps is a wall", () => {
    const step = nextStep(assessReadiness(input()));
    expect(step).not.toBeNull();
    expect(typeof step?.ask).toBe("string");
  });

  it("returns null when nothing is missing", () => {
    const r = assessReadiness(
      input({
        confirmedClaims: [...FULL_IDENTITY, ...claims("skill", 5)],
        preferences: {
          targetRoleFamilies: ["X"],
          allowedWorkRegions: ["Y"],
          preferredEngagementTypes: ["freelance"],
          remotePolicy: "remote_only",
        },
        testimonialCount: 2,
        openTrajectoryQuestions: 0,
      }),
    );
    expect(nextStep(r)).toBeNull();
  });
});
