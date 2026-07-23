import { describe, expect, it } from "vitest";
import {
  claimValueLabel,
  foundationProgress,
  isSupported,
  nextStep,
  parseAnswer,
  type LivingClaim,
  type LivingState,
} from "@/lib/profile/interview";
import type { ClaimKind, ClaimState } from "@/domain/profile";

let seq = 0;
function claim(
  kind: ClaimKind,
  state: ClaimState,
  value?: Record<string, unknown>,
): LivingClaim {
  seq += 1;
  return {
    id: `c-${seq}`,
    kind,
    state,
    value:
      value ??
      (
        {
          role: { title: "Product Designer" },
          seniority: { level: "Senior" },
          summary: { text: "Vingt ans de produit." },
          years_experience: { years: 20 },
          skill: { name: "UX" },
          achievement: { title: "Refonte du checkout" },
        } as Record<ClaimKind, Record<string, unknown>>
      )[kind],
  };
}

function state(
  claims: LivingClaim[],
  extra?: Partial<LivingState>,
): LivingState {
  return { claims, evidence: [], links: [], ...extra };
}

const CONFIRMED_FOUNDATION = [
  claim("role", "confirmed"),
  claim("seniority", "confirmed"),
  claim("years_experience", "confirmed"),
  claim("summary", "confirmed"),
  claim("skill", "confirmed"),
  claim("achievement", "confirmed"),
];

describe("nextStep — deterministic priority", () => {
  it("starts an empty interview with the ROLE question (profile-centric)", () => {
    expect(nextStep(state([]))).toEqual({ type: "ask", kind: "role" });
  });

  it("always surfaces the oldest pending decision before asking anything", () => {
    const pending = claim("seniority", "proposed");
    const s = state([claim("role", "confirmed"), pending]);
    expect(nextStep(s)).toEqual({ type: "decide", claim: pending });
  });

  it("a needs_review claim triggers its kind-specific deepening step", () => {
    const reviewing = claim("role", "needs_review");
    expect(nextStep(state([reviewing]))).toEqual({
      type: "deepen",
      claim: reviewing,
    });
  });

  it("follows the fixed foundation order for missing elements", () => {
    const s = state([
      claim("role", "confirmed"),
      claim("seniority", "confirmed"),
    ]);
    expect(nextStep(s)).toEqual({ type: "ask", kind: "years_experience" });
  });

  it("NEVER re-asks a confirmed element (dedicated guarantee)", () => {
    for (const done of CONFIRMED_FOUNDATION) {
      const step = nextStep(state([done]));
      if (step.type === "ask") {
        expect(step.kind).not.toBe(done.kind);
      }
    }
    // Full foundation → nothing left to ask at all.
    const step = nextStep(state(CONFIRMED_FOUNDATION));
    expect(step.type).not.toBe("ask");
  });

  it("skips an explicitly rejected element instead of nagging", () => {
    const s = state([
      claim("role", "rejected"),
      claim("seniority", "confirmed"),
    ]);
    // role is skipped → next missing is years_experience.
    expect(nextStep(s)).toEqual({ type: "ask", kind: "years_experience" });
  });

  it("asks for a first skill, then a first achievement", () => {
    const singles = CONFIRMED_FOUNDATION.filter(
      (c) => c.kind !== "skill" && c.kind !== "achievement",
    );
    expect(nextStep(state(singles))).toEqual({ type: "ask", kind: "skill" });
    expect(nextStep(state([...singles, claim("skill", "confirmed")]))).toEqual({
      type: "ask",
      kind: "achievement",
    });
  });

  it("suggests evidence for a confirmed, unsupported achievement", () => {
    const s = state(CONFIRMED_FOUNDATION);
    const step = nextStep(s);
    expect(step.type).toBe("suggest_evidence");
    if (step.type === "suggest_evidence") {
      expect(step.claim.kind).toBe("achievement");
    }
  });

  it("is complete when the achievement is backed by confirmed proof", () => {
    const achievement = CONFIRMED_FOUNDATION.find(
      (c) => c.kind === "achievement",
    )!;
    const s = state(CONFIRMED_FOUNDATION, {
      evidence: [
        {
          id: "e-1",
          title: "Refonte du checkout",
          statement: "+18 %",
          role_played: "Lead designer",
          verification_status: "user_confirmed",
          state: "confirmed",
        },
      ],
      links: [{ id: "l-1", claim_id: achievement.id, evidence_id: "e-1" }],
    });
    expect(nextStep(s)).toEqual({ type: "complete" });
  });

  it("resume is a pure recomputation: same state, same step", () => {
    const s = state([claim("role", "confirmed"), claim("skill", "proposed")]);
    expect(nextStep(s)).toEqual(nextStep(structuredClone(s)));
  });
});

describe("isSupported — honest 'backed by proof' tier", () => {
  const base = claim("achievement", "confirmed");
  const proof = {
    id: "e-1",
    title: "t",
    statement: "s",
    role_played: null,
    verification_status: "user_confirmed",
    state: "confirmed" as ClaimState,
  };

  it("requires confirmed claim + active link + CONFIRMED evidence", () => {
    const supported = state([base], {
      evidence: [proof],
      links: [{ id: "l", claim_id: base.id, evidence_id: "e-1" }],
    });
    expect(isSupported(supported, base.id)).toBe(true);

    const proposedProof = state([base], {
      evidence: [{ ...proof, state: "proposed" as ClaimState }],
      links: [{ id: "l", claim_id: base.id, evidence_id: "e-1" }],
    });
    expect(isSupported(proposedProof, base.id)).toBe(false);

    const unlinked = state([base], { evidence: [proof], links: [] });
    expect(isSupported(unlinked, base.id)).toBe(false);
  });

  it("a merely proposed claim is never 'backed'", () => {
    const proposed = claim("achievement", "proposed");
    const s = state([proposed], {
      evidence: [proof],
      links: [{ id: "l", claim_id: proposed.id, evidence_id: "e-1" }],
    });
    expect(isSupported(s, proposed.id)).toBe(false);
  });
});

describe("foundationProgress — honest count, no fake percentage", () => {
  it("counts confirmed foundation elements out of six", () => {
    expect(foundationProgress(state([]))).toEqual({ done: 0, total: 6 });
    expect(
      foundationProgress(
        state([claim("role", "confirmed"), claim("skill", "confirmed")]),
      ),
    ).toEqual({ done: 2, total: 6 });
    expect(foundationProgress(state(CONFIRMED_FOUNDATION))).toEqual({
      done: 6,
      total: 6,
    });
  });

  it("proposed or rejected claims do not count", () => {
    expect(
      foundationProgress(
        state([claim("role", "proposed"), claim("summary", "rejected")]),
      ),
    ).toEqual({ done: 0, total: 6 });
  });
});

describe("parseAnswer — verbatim proposals, nothing 'deduced'", () => {
  it("wraps free text into the kind's value shape, normalized", () => {
    expect(parseAnswer("role", "  Product   Designer ")).toEqual({
      ok: true,
      value: { title: "Product Designer" },
    });
    expect(parseAnswer("skill", "Design system")).toEqual({
      ok: true,
      value: { name: "Design system" },
    });
  });

  it("extracts a plausible year count and rejects nonsense", () => {
    expect(parseAnswer("years_experience", "environ 20 ans")).toEqual({
      ok: true,
      value: { years: 20 },
    });
    expect(parseAnswer("years_experience", "beaucoup")).toEqual({
      ok: false,
      reason: "years_invalid",
    });
  });

  it("refuses empty input", () => {
    expect(parseAnswer("summary", "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("claimValueLabel", () => {
  it("renders every kind for humans", () => {
    expect(claimValueLabel(claim("years_experience", "confirmed"))).toBe(
      "20 ans",
    );
    expect(claimValueLabel(claim("role", "confirmed"))).toBe(
      "Product Designer",
    );
  });
});
