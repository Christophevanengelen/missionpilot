import { describe, expect, it } from "vitest";
import type { ProfilePreferences } from "@/domain/profile";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
  type ConstraintVerdict,
  type HardConstraintKey,
  type OpportunityFacts,
  type OpportunityRow,
} from "@/lib/matching/hard-constraints";

const basePrefs: ProfilePreferences = {
  targetRoleFamilies: [],
  preferredEngagementTypes: [],
  languages: [],
  allowedWorkRegions: [],
  hardExclusions: [],
  targetDayRate: null,
  minimumDayRate: null,
  baseCurrency: null,
  remotePolicy: null,
  timezoneOverlap: null,
  travelTolerance: null,
};

const baseFacts: OpportunityFacts = {
  engagementType: null,
  remoteType: null,
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  locationText: null,
  title: null,
  organization: null,
  description: null,
  skills: [],
  requirements: [],
  responsibilities: [],
};

const prefs = (p: Partial<ProfilePreferences>) => ({ ...basePrefs, ...p });
const facts = (f: Partial<OpportunityFacts>) => ({ ...baseFacts, ...f });
const verdictOf = (
  p: ProfilePreferences,
  f: OpportunityFacts,
  key: HardConstraintKey,
): ConstraintVerdict =>
  evaluateHardConstraints(p, f).checks.find((c) => c.key === key)!.verdict;

describe("evaluateHardConstraints — no constraints", () => {
  it("is eligible with everything not_constrained", () => {
    const r = evaluateHardConstraints(basePrefs, baseFacts);
    expect(r.gate).toBe("eligible");
    expect(r.checks.every((c) => c.verdict === "not_constrained")).toBe(true);
  });
});

describe("remote_only policy (only remote_only is hard)", () => {
  const p = prefs({ remotePolicy: "remote_only" });
  it("onsite / hybrid violate", () => {
    expect(verdictOf(p, facts({ remoteType: "onsite" }), "remote")).toBe(
      "violated",
    );
    expect(verdictOf(p, facts({ remoteType: "hybrid" }), "remote")).toBe(
      "violated",
    );
  });
  it("remote_only passes", () => {
    expect(verdictOf(p, facts({ remoteType: "remote_only" }), "remote")).toBe(
      "pass",
    );
  });
  it("unspecified / null are unknown (honest)", () => {
    expect(verdictOf(p, facts({ remoteType: "unspecified" }), "remote")).toBe(
      "unknown",
    );
    expect(verdictOf(p, facts({ remoteType: null }), "remote")).toBe("unknown");
  });
  it("soft policies are not a hard gate", () => {
    for (const policy of ["remote_first", "hybrid", "onsite_ok"] as const) {
      expect(
        verdictOf(
          prefs({ remotePolicy: policy }),
          facts({ remoteType: "onsite" }),
          "remote",
        ),
      ).toBe("not_constrained");
    }
  });
});

describe("preferred engagement types", () => {
  const p = prefs({ preferredEngagementTypes: ["freelance"] });
  it("matching type passes, other violates, null is unknown", () => {
    expect(
      verdictOf(p, facts({ engagementType: "freelance" }), "engagement_type"),
    ).toBe("pass");
    expect(
      verdictOf(p, facts({ engagementType: "permanent" }), "engagement_type"),
    ).toBe("violated");
    expect(
      verdictOf(p, facts({ engagementType: null }), "engagement_type"),
    ).toBe("unknown");
  });
  it("empty list is not a constraint", () => {
    expect(
      verdictOf(
        basePrefs,
        facts({ engagementType: "permanent" }),
        "engagement_type",
      ),
    ).toBe("not_constrained");
  });
});

describe("minimum day rate (currency/period-aware)", () => {
  const p = prefs({ minimumDayRate: 500, baseCurrency: "EUR" });
  const day = {
    compensationPeriod: "day" as const,
    compensationCurrency: "EUR" as const,
  };
  it("passes when the whole range is at or above the floor", () => {
    expect(
      verdictOf(
        p,
        facts({ ...day, compensationMin: 600, compensationMax: 700 }),
        "minimum_day_rate",
      ),
    ).toBe("pass");
  });
  it("violates when even the best case is below the floor", () => {
    expect(
      verdictOf(
        p,
        facts({ ...day, compensationMin: 300, compensationMax: 400 }),
        "minimum_day_rate",
      ),
    ).toBe("violated");
  });
  it("is unknown when the range straddles the floor", () => {
    expect(
      verdictOf(
        p,
        facts({ ...day, compensationMin: 400, compensationMax: 600 }),
        "minimum_day_rate",
      ),
    ).toBe("unknown");
  });
  it("is unknown on currency mismatch, wrong period, or missing pieces (no FX/period guessing)", () => {
    expect(
      verdictOf(
        p,
        facts({
          compensationPeriod: "day",
          compensationCurrency: "USD",
          compensationMin: 300,
        }),
        "minimum_day_rate",
      ),
    ).toBe("unknown");
    expect(
      verdictOf(
        p,
        facts({
          compensationPeriod: "month",
          compensationCurrency: "EUR",
          compensationMin: 300,
        }),
        "minimum_day_rate",
      ),
    ).toBe("unknown");
    expect(verdictOf(p, facts({ ...day }), "minimum_day_rate")).toBe("unknown"); // no figure
    expect(
      verdictOf(
        prefs({ minimumDayRate: 500 }),
        facts({ ...day, compensationMin: 100 }),
        "minimum_day_rate",
      ),
    ).toBe("unknown"); // no base currency
  });
  it("treats a genuinely single-sided range as unbounded on the unstated side", () => {
    // max-only ≥ floor: the worst case is unbounded below ⇒ cannot claim pass.
    expect(
      verdictOf(p, facts({ ...day, compensationMax: 550 }), "minimum_day_rate"),
    ).toBe("unknown");
    // min-only < floor: the best case is unbounded above ⇒ cannot claim
    // violated (that would wrongly EXCLUDE).
    expect(
      verdictOf(p, facts({ ...day, compensationMin: 450 }), "minimum_day_rate"),
    ).toBe("unknown");
    // A one-sided range still decides when the KNOWN side settles it.
    expect(
      verdictOf(p, facts({ ...day, compensationMax: 400 }), "minimum_day_rate"),
    ).toBe("violated"); // best case already below floor
    expect(
      verdictOf(p, facts({ ...day, compensationMin: 600 }), "minimum_day_rate"),
    ).toBe("pass"); // worst case already clears floor
  });
  it("is not a constraint when no floor is set", () => {
    expect(
      verdictOf(
        basePrefs,
        facts({ ...day, compensationMin: 1 }),
        "minimum_day_rate",
      ),
    ).toBe("not_constrained");
  });
});

describe("hard exclusions (word-boundary keyword blocklist)", () => {
  it("violates and names the term found in any scanned field", () => {
    const r = evaluateHardConstraints(
      prefs({ hardExclusions: ["casino"] }),
      facts({ description: "A great casino platform" }),
    );
    const check = r.checks.find((c) => c.key === "hard_exclusions")!;
    expect(check.verdict).toBe("violated");
    expect(check.detail).toBe("casino");
    expect(r.gate).toBe("excluded");
  });
  it("does not false-match a longer word (java vs javascript)", () => {
    expect(
      verdictOf(
        prefs({ hardExclusions: ["java"] }),
        facts({ skills: ["JavaScript"] }),
        "hard_exclusions",
      ),
    ).toBe("pass");
    expect(
      verdictOf(
        prefs({ hardExclusions: ["java"] }),
        facts({ skills: ["Java"] }),
        "hard_exclusions",
      ),
    ).toBe("violated");
  });
  it("passes when no term is present", () => {
    expect(
      verdictOf(
        prefs({ hardExclusions: ["casino"] }),
        facts({ description: "A banking platform" }),
        "hard_exclusions",
      ),
    ).toBe("pass");
  });
  it("is unknown when there is no text to scan", () => {
    expect(
      verdictOf(
        prefs({ hardExclusions: ["casino"] }),
        baseFacts,
        "hard_exclusions",
      ),
    ).toBe("unknown");
  });
});

describe("allowed work regions (never a false violation)", () => {
  const p = prefs({ allowedWorkRegions: ["France"] });
  it("passes when a region appears in the location", () => {
    expect(
      verdictOf(p, facts({ locationText: "Paris, France" }), "allowed_regions"),
    ).toBe("pass");
  });
  it("is unknown (not violated) when the location does not match", () => {
    expect(
      verdictOf(
        p,
        facts({ locationText: "Berlin, Germany" }),
        "allowed_regions",
      ),
    ).toBe("unknown");
  });
  it("does not false-match a region token embedded in a larger word", () => {
    // Word-boundary, not raw substring: "UK" must not match "Ukraine", nor
    // "US" match "Toulouse" (that false pass would wrongly reassure).
    expect(
      verdictOf(
        prefs({ allowedWorkRegions: ["UK"] }),
        facts({ locationText: "Kyiv, Ukraine" }),
        "allowed_regions",
      ),
    ).toBe("unknown");
    expect(
      verdictOf(
        prefs({ allowedWorkRegions: ["US"] }),
        facts({ locationText: "Toulouse, France" }),
        "allowed_regions",
      ),
    ).toBe("unknown");
    // …but a real boundary match still passes.
    expect(
      verdictOf(
        prefs({ allowedWorkRegions: ["UK"] }),
        facts({ locationText: "London, UK" }),
        "allowed_regions",
      ),
    ).toBe("pass");
  });
  it("is unknown when the location is missing", () => {
    expect(verdictOf(p, baseFacts, "allowed_regions")).toBe("unknown");
  });
});

describe("gate aggregation", () => {
  it("a single violation excludes even amid unknowns", () => {
    const r = evaluateHardConstraints(
      prefs({
        preferredEngagementTypes: ["freelance"],
        remotePolicy: "remote_only",
      }),
      facts({ engagementType: "permanent", remoteType: null }),
    );
    expect(r.gate).toBe("excluded");
  });
  it("no violation but some unknown ⇒ review", () => {
    const r = evaluateHardConstraints(
      prefs({ remotePolicy: "remote_only" }),
      facts({ remoteType: "unspecified" }),
    );
    expect(r.gate).toBe("review");
  });
  it("all pass / not_constrained ⇒ eligible", () => {
    const r = evaluateHardConstraints(
      prefs({
        preferredEngagementTypes: ["freelance"],
        remotePolicy: "remote_only",
      }),
      facts({ engagementType: "freelance", remoteType: "remote_only" }),
    );
    expect(r.gate).toBe("eligible");
  });
});

describe("opportunityFactsFromRow", () => {
  it("maps snake_case, rejects out-of-vocabulary enums, and filters non-strings", () => {
    const row: OpportunityRow = {
      engagement_type: "freelance",
      remote_type: "banana", // invalid → null
      compensation_min: 400,
      compensation_max: 600,
      compensation_currency: "EUR",
      compensation_period: "day",
      location_text: "Lyon",
      title: "Staff Engineer",
      organization: "Globex",
      description: null,
      skills: ["Go", 5, null, "Postgres"],
      requirements: "not-an-array",
      responsibilities: [],
    };
    const f = opportunityFactsFromRow(row);
    expect(f.engagementType).toBe("freelance");
    expect(f.remoteType).toBeNull();
    expect(f.compensationCurrency).toBe("EUR");
    expect(f.compensationPeriod).toBe("day");
    expect(f.skills).toEqual(["Go", "Postgres"]);
    expect(f.requirements).toEqual([]);
  });
});
