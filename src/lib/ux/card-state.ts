/**
 * Card lifecycle states for the conversational UI
 * (docs/ux/CONVERSATION_FRAMEWORK.md). `needs_review` is shared verbatim with
 * the AI-output envelope; the others are the UX-layer lifecycle. Presentation
 * only — no persistence here.
 */
export const CARD_STATES = [
  "proposed",
  "confirmed",
  "needs_review",
  "rejected",
] as const;

export type CardState = (typeof CARD_STATES)[number];

/**
 * Per-state badge styling. The label TEXT always uses a high-contrast
 * foreground color (AA-safe); the state hue is carried only by the border and
 * a faint fill — a secondary cue, never the sole carrier of meaning.
 */
export const CARD_STATE_STYLE: Record<CardState, string> = {
  proposed: "border-border text-foreground",
  confirmed: "border-success/50 bg-success/8 text-foreground",
  needs_review: "border-warning/60 bg-warning/8 text-foreground",
  rejected: "border-border text-muted-foreground line-through",
};
