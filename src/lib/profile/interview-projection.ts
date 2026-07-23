/**
 * Projection of the living state + engine step into the compact
 * conversational narrative and the structured panel facts. Pure (testable);
 * the thread is a PROJECTION of business state, never a persisted chat log —
 * it shows a compact narrative of the current state and pending decisions,
 * and must never pretend to be an exhaustive transcript.
 */
import { t } from "@/lib/copy";
import type { KnownFact, Turn } from "@/lib/ux/conversation-types";
import type { ClaimKind } from "@/domain/profile";
import {
  claimValueLabel,
  foundationProgress,
  isSupported,
  type InterviewStep,
  type LivingState,
} from "./interview";

/** The question text for the current step (single active question). */
export function stepQuestion(step: InterviewStep): string | null {
  const copy = t().interview;
  switch (step.type) {
    case "ask":
      return copy.questions[step.kind];
    case "deepen":
      return copy.deepenQuestions[step.claim.kind];
    case "decide":
      return null; // the decision card IS the active question
    case "suggest_evidence":
      return copy.suggestEvidence(claimValueLabel(step.claim));
    case "complete":
      return null;
  }
}

/** Compact narrative turns for the thread (never a transcript). */
export function buildTurns(state: LivingState, step: InterviewStep): Turn[] {
  const copy = t().interview;
  const isEmpty = state.claims.length === 0;
  const turns: Turn[] = [
    {
      role: "assistant",
      id: "t-lead",
      text: isEmpty ? copy.welcome : copy.resume,
      lead: true,
    },
  ];

  if (step.type === "decide") {
    turns.push({
      role: "assistant",
      id: `t-decide-${step.claim.id}`,
      text: copy.understood,
      card: {
        kind: "understanding",
        id: step.claim.id,
        title: copy.claimCardTitle,
        state: step.claim.state,
        fields: [
          {
            label: copy.kindLabels[step.claim.kind],
            value: claimValueLabel(step.claim),
          },
        ],
      },
    });
  } else if (step.type === "deepen") {
    turns.push({
      role: "assistant",
      id: `t-deepen-${step.claim.id}`,
      text: copy.understood,
      card: {
        kind: "understanding",
        id: step.claim.id,
        title: copy.claimCardTitle,
        state: step.claim.state,
        fields: [
          {
            label: copy.kindLabels[step.claim.kind],
            value: claimValueLabel(step.claim),
          },
        ],
      },
      question: copy.deepenQuestions[step.claim.kind],
    });
  } else if (step.type === "ask") {
    turns.push({
      role: "assistant",
      id: `t-ask-${step.kind}`,
      text: "",
      question: copy.questions[step.kind],
    });
  } else if (step.type === "suggest_evidence") {
    turns.push({
      role: "assistant",
      id: `t-evidence-${step.claim.id}`,
      text: copy.suggestEvidence(claimValueLabel(step.claim)),
    });
  } else {
    turns.push({
      role: "assistant",
      id: "t-complete",
      text: copy.complete,
      chips: [
        copy.questions.skill,
        copy.questions.achievement,
        copy.panel.addEvidence,
      ],
    });
  }

  return turns;
}

const PANEL_KINDS: readonly ClaimKind[] = [
  "role",
  "seniority",
  "years_experience",
  "summary",
];

/** Structured panel facts (single-valued rows + one row per skill/achievement). */
export function buildFacts(state: LivingState): KnownFact[] {
  const copy = t().interview;
  const facts: KnownFact[] = [];
  for (const kind of PANEL_KINDS) {
    const active = state.claims.find((c) => c.kind === kind);
    if (active) {
      facts.push({
        label: copy.kindLabels[kind],
        value: claimValueLabel(active),
        state: active.state,
        supported: isSupported(state, active.id),
      });
    }
  }
  for (const kind of ["skill", "achievement"] as const) {
    for (const c of state.claims.filter((cl) => cl.kind === kind)) {
      facts.push({
        label: copy.kindLabels[kind],
        value: claimValueLabel(c),
        state: c.state,
        supported: isSupported(state, c.id),
      });
    }
  }
  return facts;
}

export { foundationProgress };
export type { InterviewStep, LivingState };
