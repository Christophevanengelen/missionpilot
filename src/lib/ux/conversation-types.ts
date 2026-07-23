/**
 * Shared types for the conversational UI. Kept separate from any mock data so
 * the components (thread, cards, context) are reusable by real Phase 1-4
 * features — they depend on these types, never on the preview's fixtures.
 */
import type { CardState } from "@/lib/ux/card-state";
import type { ScoreComponent } from "@/components/cards/score-card";

export type VerdictKey =
  | "strong_match"
  | "possible_match"
  | "low_priority"
  | "do_not_apply"
  | "needs_review";

export type Field = {
  label: string;
  value?: string;
  warn?: string;
  /** Render as small pills (skills, tags) instead of a plain value. */
  chips?: string[];
  /** Span the full width of the card's field grid. */
  wide?: boolean;
};

export type UnderstandingCard = {
  kind: "understanding";
  id: string;
  title: string;
  state: CardState;
  fields: Field[];
};

export type EvidenceCard = {
  kind: "evidence";
  id: string;
  title: string;
  state: CardState;
  fields: Field[];
  restorable?: boolean;
};

export type OpportunityCard = {
  kind: "opportunity";
  id: string;
  title: string;
  state: CardState;
  role: string;
  company: string;
  verdict: VerdictKey;
  score: number;
  confidence: number;
  remote: string;
  rate: string;
  strength: string;
  risk: string;
};

export type ScoreCard = {
  kind: "score";
  id: string;
  title: string;
  state: CardState;
  weighted: number;
  confidence: number;
  hardConstraint: "pass" | "warn" | "fail";
  components: ScoreComponent[];
};

export type ApprovalCard = {
  kind: "approval";
  id: string;
  title: string;
  action: string;
  detail: string;
  destination: string;
  blocked: boolean;
};

export type ThreadCardData =
  UnderstandingCard | EvidenceCard | OpportunityCard | ScoreCard | ApprovalCard;

export type AssistantTurn = {
  role: "assistant";
  id: string;
  text: string;
  card?: ThreadCardData;
  question?: string;
  chips?: string[];
  /** Presentation flag: renders the text as the conversation's opening lead. */
  lead?: boolean;
};

export type UserTurn = { role: "user"; id: string; text: string };
export type Turn = AssistantTurn | UserTurn;

export type KnownFact = { label: string; value: string; state: CardState };
