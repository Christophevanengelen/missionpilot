import { describe, expect, it } from "vitest";
import type { ProfilePreferences } from "@/domain/profile";
import type { OpportunityFacts } from "@/lib/matching/hard-constraints";
import {
  profileSignalsFromClaims,
  scoreMatch,
  type ProfileSignals,
  type ScoreComponentKey,
} from "@/lib/matching/score";

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
const noSignals: ProfileSignals = { skills: [] };

const comp = (
  p: ProfilePreferences,
  s: ProfileSignals,
  f: OpportunityFacts,
  key: ScoreComponentKey,
) => scoreMatch(p, s, f).components.find((c) => c.key === key)!;

describe("scoreMatch — honesty (undecidable ⇒ null, excluded from overall)", () => {
  it("with no data at all: every component null, overall null, confidence none", () => {
    const r = scoreMatch(basePrefs, noSignals, baseFacts);
    expect(r.components.every((c) => c.score === null)).toBe(true);
    expect(r.overall).toBeNull();
    expect(r.confidence).toBe("none");
  });
});

describe("skills component (evidence-backed overlap)", () => {
  it("scores the share of demanded skills the profile covers and lists them", () => {
    const c = comp(
      basePrefs,
      { skills: ["Go", "Postgres"] },
      facts({ skills: ["Go", "Rust"] }),
      "skills",
    );
    expect(c.score).toBe(50); // 1 of 2 demanded covered
    expect(c.evidence).toEqual(["Go"]); // opportunity casing
  });
  it("is case-insensitive and de-duplicates the demand set", () => {
    const c = comp(
      basePrefs,
      { skills: ["go"] },
      facts({ skills: ["Go", "GO"] }),
      "skills",
    );
    expect(c.score).toBe(100);
  });
  it("is null when either side has no skills", () => {
    expect(
      comp(basePrefs, noSignals, facts({ skills: ["Go"] }), "skills").score,
    ).toBeNull();
    expect(
      comp(basePrefs, { skills: ["Go"] }, baseFacts, "skills").score,
    ).toBeNull();
  });
});

describe("rate component (currency/period-aware)", () => {
  const p = prefs({ targetDayRate: 700, baseCurrency: "EUR" });
  const day = {
    compensationPeriod: "day" as const,
    compensationCurrency: "EUR" as const,
  };
  it("scores the midpoint against the target", () => {
    expect(
      comp(
        p,
        noSignals,
        facts({ ...day, compensationMin: 600, compensationMax: 700 }),
        "rate",
      ).score,
    ).toBe(93); // 650/700
  });
  it("caps at 100 when at or above target", () => {
    expect(
      comp(
        p,
        noSignals,
        facts({ ...day, compensationMin: 800, compensationMax: 900 }),
        "rate",
      ).score,
    ).toBe(100);
  });
  it("falls back to the minimum when no target is set", () => {
    expect(
      comp(
        prefs({ minimumDayRate: 500, baseCurrency: "EUR" }),
        noSignals,
        facts({ ...day, compensationMin: 500, compensationMax: 500 }),
        "rate",
      ).score,
    ).toBe(100);
  });
  it("is null on currency/period mismatch or no reference (no guessing)", () => {
    expect(
      comp(
        p,
        noSignals,
        facts({
          compensationPeriod: "month",
          compensationCurrency: "EUR",
          compensationMin: 700,
        }),
        "rate",
      ).score,
    ).toBeNull();
    expect(
      comp(
        p,
        noSignals,
        facts({
          compensationPeriod: "day",
          compensationCurrency: "USD",
          compensationMin: 700,
        }),
        "rate",
      ).score,
    ).toBeNull();
    expect(
      comp(
        basePrefs,
        noSignals,
        facts({ ...day, compensationMin: 700 }),
        "rate",
      ).score,
    ).toBeNull();
  });
});

describe("remote component (policy × remote type)", () => {
  it("maps by policy and is null when unknown or no policy", () => {
    expect(
      comp(
        prefs({ remotePolicy: "remote_only" }),
        noSignals,
        facts({ remoteType: "remote_only" }),
        "remote",
      ).score,
    ).toBe(100);
    expect(
      comp(
        prefs({ remotePolicy: "remote_only" }),
        noSignals,
        facts({ remoteType: "hybrid" }),
        "remote",
      ).score,
    ).toBe(40);
    expect(
      comp(
        prefs({ remotePolicy: "remote_only" }),
        noSignals,
        facts({ remoteType: "onsite" }),
        "remote",
      ).score,
    ).toBe(0);
    expect(
      comp(
        prefs({ remotePolicy: "onsite_ok" }),
        noSignals,
        facts({ remoteType: "onsite" }),
        "remote",
      ).score,
    ).toBe(100);
    expect(
      comp(
        prefs({ remotePolicy: "remote_only" }),
        noSignals,
        facts({ remoteType: "unspecified" }),
        "remote",
      ).score,
    ).toBeNull();
    expect(
      comp(basePrefs, noSignals, facts({ remoteType: "onsite" }), "remote")
        .score,
    ).toBeNull();
  });
});

describe("engagement component", () => {
  it("is 100 in-list, 0 out-of-list, null when unknown or unconstrained", () => {
    const p = prefs({ preferredEngagementTypes: ["freelance"] });
    expect(
      comp(p, noSignals, facts({ engagementType: "freelance" }), "engagement")
        .score,
    ).toBe(100);
    expect(
      comp(p, noSignals, facts({ engagementType: "permanent" }), "engagement")
        .score,
    ).toBe(0);
    expect(
      comp(p, noSignals, facts({ engagementType: null }), "engagement").score,
    ).toBeNull();
    expect(
      comp(
        basePrefs,
        noSignals,
        facts({ engagementType: "freelance" }),
        "engagement",
      ).score,
    ).toBeNull();
  });
});

describe("overall aggregation + confidence", () => {
  it("renormalizes weights over scored components only", () => {
    // Only skills (50) scorable ⇒ overall equals it; confidence low (1/4).
    const r = scoreMatch(
      basePrefs,
      { skills: ["Go"] },
      facts({ skills: ["Go", "Rust"] }),
    );
    expect(r.overall).toBe(50);
    expect(r.confidence).toBe("low");
  });
  it("weights skills (0.4) and remote (0.2) correctly", () => {
    const r = scoreMatch(
      prefs({ remotePolicy: "remote_only" }),
      { skills: ["Go"] },
      facts({ skills: ["Go", "Rust"], remoteType: "remote_only" }),
    );
    // (50*0.4 + 100*0.2) / (0.4+0.2) = 40/0.6 = 66.67 ⇒ 67; 2/4 ⇒ medium.
    expect(r.overall).toBe(67);
    expect(r.confidence).toBe("medium");
  });
  it("reaches high confidence when all four components score", () => {
    const r = scoreMatch(
      prefs({
        remotePolicy: "remote_only",
        preferredEngagementTypes: ["freelance"],
        targetDayRate: 700,
        baseCurrency: "EUR",
      }),
      { skills: ["Go"] },
      facts({
        skills: ["Go"],
        remoteType: "remote_only",
        engagementType: "freelance",
        compensationPeriod: "day",
        compensationCurrency: "EUR",
        compensationMin: 700,
        compensationMax: 700,
      }),
    );
    expect(r.overall).toBe(100);
    expect(r.confidence).toBe("high");
  });
});

describe("profileSignalsFromClaims", () => {
  it("keeps only confirmed skill names", () => {
    const signals = profileSignalsFromClaims([
      { kind: "skill", state: "confirmed", value: { name: "Go" } },
      { kind: "skill", state: "proposed", value: { name: "Rust" } },
      { kind: "role", state: "confirmed", value: { title: "Staff Engineer" } },
      { kind: "skill", state: "confirmed", value: { name: "" } },
      { kind: "skill", state: "confirmed", value: {} },
    ]);
    expect(signals.skills).toEqual(["Go"]);
  });
});
