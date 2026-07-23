/**
 * Deterministic interview engine — the business brain of the guided profile
 * conversation. Pure functions over the living state (no React, no I/O):
 * given the active claims, evidence and links, decide the single most useful
 * next step and project the compact conversational narrative.
 *
 * Guarantees (unit-tested):
 *  - a confirmed fact is NEVER asked again;
 *  - one active question at a time, in a fixed, explainable order;
 *  - an explicitly rejected statement is skipped (never nagged) — the user
 *    restores it from its card;
 *  - resuming is a pure recomputation: no hidden flow state anywhere;
 *  - the user's answer is presented as an explicit proposal — nothing is
 *    "deduced"; only a human confirmation makes it a fact.
 */
import type { ClaimKind, ClaimState } from "@/domain/profile";
import { SINGLE_VALUED_KINDS } from "@/domain/profile";

export type LivingClaim = {
  id: string;
  kind: ClaimKind;
  value: Record<string, unknown>;
  state: ClaimState;
};

export type LivingEvidence = {
  id: string;
  title: string;
  statement: string;
  role_played: string | null;
  verification_status: string;
  state: ClaimState;
};

export type LivingLink = {
  id: string;
  claim_id: string;
  evidence_id: string;
};

export type LivingState = {
  claims: LivingClaim[];
  evidence: LivingEvidence[];
  links: LivingLink[];
};

/** The six foundation elements, in the fixed interview order. */
export const FOUNDATION_ORDER: readonly ClaimKind[] = [
  "role",
  "seniority",
  "years_experience",
  "summary",
  "skill",
  "achievement",
];

export type InterviewStep =
  /** A proposal awaits the user's decision (shown before anything else). */
  | { type: "decide"; claim: LivingClaim }
  /** A statement was sent to review: ask the kind's deepening question and
   *  expect a replacement formulation. */
  | { type: "deepen"; claim: LivingClaim }
  /** Ask for a missing foundation element. */
  | { type: "ask"; kind: ClaimKind }
  /** A confirmed achievement has no active evidence — suggest proof. */
  | { type: "suggest_evidence"; claim: LivingClaim }
  /** Foundation complete (6/6 confirmed) — open enrichment. */
  | { type: "complete" }
  /** Nothing left to ask, but the foundation is INCOMPLETE because elements
   *  were rejected — honest terminal: restore is the way forward. Rejected
   *  elements are never re-asked automatically. */
  | { type: "paused"; progress: FoundationProgress };

function activeOf(state: LivingState, kind: ClaimKind): LivingClaim[] {
  return state.claims.filter((c) => c.kind === kind);
}

function hasConfirmed(state: LivingState, kind: ClaimKind): boolean {
  return activeOf(state, kind).some((c) => c.state === "confirmed");
}

function hasRejected(state: LivingState, kind: ClaimKind): boolean {
  return activeOf(state, kind).some((c) => c.state === "rejected");
}

/** Claims currently backed: confirmed claim + active link + confirmed proof. */
export function isSupported(state: LivingState, claimId: string): boolean {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.state !== "confirmed") return false;
  return state.links.some((l) => {
    if (l.claim_id !== claimId) return false;
    const proof = state.evidence.find((e) => e.id === l.evidence_id);
    return proof?.state === "confirmed";
  });
}

/** The single most useful next step — strictly ordered, fully deterministic. */
export function nextStep(state: LivingState): InterviewStep {
  // 1. Show what was understood BEFORE moving on: oldest pending decision.
  const pending = state.claims.find((c) => c.state === "proposed");
  if (pending) return { type: "decide", claim: pending };

  const reviewing = state.claims.find((c) => c.state === "needs_review");
  if (reviewing) return { type: "deepen", claim: reviewing };

  // 2. Missing single-valued foundations, fixed order. A kind the user
  //    explicitly rejected is SKIPPED (restore happens on its card).
  for (const kind of FOUNDATION_ORDER) {
    if (SINGLE_VALUED_KINDS.includes(kind)) {
      if (!hasConfirmed(state, kind) && !hasRejected(state, kind)) {
        return { type: "ask", kind };
      }
    } else if (kind === "skill" || kind === "achievement") {
      // 3./4. At least one confirmed skill, then one confirmed achievement.
      if (
        !hasConfirmed(state, kind) &&
        !activeOf(state, kind).some((c) => c.state === "rejected")
      ) {
        return { type: "ask", kind };
      }
    }
  }

  // 5. A confirmed achievement without active confirmed proof → suggest one.
  const unsupported = state.claims.find(
    (c) =>
      c.kind === "achievement" &&
      c.state === "confirmed" &&
      !isSupported(state, c.id),
  );
  if (unsupported) return { type: "suggest_evidence", claim: unsupported };

  // `complete` is RESERVED for 6/6 confirmed; anything less (rejected
  // elements) ends in the honest `paused` terminal.
  const progress = foundationProgress(state);
  if (progress.done < progress.total) {
    return { type: "paused", progress };
  }
  return { type: "complete" };
}

// ---------------------------------------------------------------------------
// Foundation progress — honest count, never a fake-precision score.

export type FoundationProgress = { done: number; total: number };

export function foundationProgress(state: LivingState): FoundationProgress {
  let done = 0;
  for (const kind of FOUNDATION_ORDER) {
    if (hasConfirmed(state, kind)) done += 1;
  }
  return { done, total: FOUNDATION_ORDER.length };
}

// ---------------------------------------------------------------------------
// Answer parsing — verbatim, lightly normalized proposals. Nothing clever:
// the text the user typed becomes the proposed value for the ACTIVE kind.

export type ParsedAnswer =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "empty" | "years_invalid" };

export function parseAnswer(kind: ClaimKind, raw: string): ParsedAnswer {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "empty" };
  switch (kind) {
    case "role":
      return { ok: true, value: { title: text.slice(0, 200) } };
    case "seniority":
      return { ok: true, value: { level: text.slice(0, 100) } };
    case "summary":
      return { ok: true, value: { text: text.slice(0, 2000) } };
    case "skill":
      return { ok: true, value: { name: text.slice(0, 120) } };
    case "achievement":
      return { ok: true, value: { title: text.slice(0, 300) } };
    case "years_experience": {
      // First 1-2 digit run wins ("environ 20 ans" → 20). Deliberately
      // simple: the value is a confirm-first PROPOSAL the user sees and can
      // correct — never a silent deduction.
      const match = text.match(/\d{1,2}/);
      if (!match) return { ok: false, reason: "years_invalid" };
      const years = Number.parseInt(match[0], 10);
      if (years > 80) return { ok: false, reason: "years_invalid" };
      return { ok: true, value: { years } };
    }
  }
}

/** Human-readable rendering of a claim value (panel + cards). */
export function claimValueLabel(claim: {
  kind: ClaimKind;
  value: Record<string, unknown>;
}): string {
  const v = claim.value as Record<string, string | number>;
  switch (claim.kind) {
    case "role":
      return String(v.title ?? "");
    case "seniority":
      return String(v.level ?? "");
    case "summary":
      return String(v.text ?? "");
    case "years_experience":
      return `${v.years ?? "?"} ans`;
    case "skill":
      return String(v.name ?? "");
    case "achievement":
      return String(v.title ?? "");
  }
}
