"use client";

import { AlertTriangle, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardShell, CardField } from "@/components/cards/card-shell";
import { OpportunityCard } from "@/components/cards/opportunity-card";
import { ScoreBreakdown } from "@/components/cards/score-card";
import { t } from "@/lib/copy";
import type {
  AssistantTurn,
  ThreadState,
  Turn,
} from "@/lib/ux/conversation-types";

/**
 * The conversation thread — the primary surface. Prop-driven (takes `turns`),
 * so real Phase 1-4 features feed it real data; the UX Preview feeds mock
 * data. Assistant turns render at most one important question and at most one
 * card. New turns/cards announce via the polite live region.
 */
export function Thread({
  turns,
  state,
  renderCard,
  onChip,
}: {
  turns: Turn[];
  state: ThreadState;
  /** Optional card renderer override (the real product wires actions here);
   *  defaults to the static presentational cards. */
  renderCard?: (turn: AssistantTurn) => React.ReactNode;
  /** Optional suggestion-chip handler; without it chips stay static. */
  onChip?: (chip: string) => void;
}) {
  const copy = t();

  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Chargement de la conversation"
        className="flex flex-col gap-6"
      >
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-2/3 self-end" />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <p className="text-muted-foreground text-[15px]">
        La conversation démarrera ici. Posez votre première question, ou laissez
        MissionPilot vous guider.
      </p>
    );
  }

  if (state === "error") {
    return (
      <CardShell title="Erreur" state="needs_review">
        <p className="flex items-start gap-2">
          <AlertTriangle
            aria-hidden="true"
            className="text-warning mt-0.5 size-4 shrink-0"
          />
          <span>
            {copy.error.analyze} {copy.error.retained}
          </span>
        </p>
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm">
            {copy.actions.retry}
          </Button>
        </div>
      </CardShell>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {state === "offline" ? (
        <p
          role="status"
          className="border-border text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          <WifiOff aria-hidden="true" className="size-4" />
          Hors ligne — la conversation reste lisible ; les actions réseau sont
          suspendues.
        </p>
      ) : null}
      {/* Polite live region: new assistant turns / card state changes announce
          here without stealing focus. */}
      <ol
        className="flex flex-col gap-8"
        aria-label="Conversation"
        aria-live="polite"
      >
        {turns.map((turn) =>
          turn.role === "user" ? (
            <li
              key={turn.id}
              className="bg-secondary text-secondary-foreground ml-auto max-w-[78%] rounded-xl rounded-br-sm px-5 py-3 text-base"
            >
              {turn.text}
            </li>
          ) : (
            <li key={turn.id} className="flex flex-col gap-4">
              <p
                className={
                  turn.lead
                    ? "text-2xl leading-snug font-semibold tracking-tight"
                    : "text-base leading-relaxed"
                }
              >
                {turn.text}
              </p>
              {turn.card
                ? (renderCard?.(turn) ?? (
                    <ThreadCard turn={turn} disabled={state === "offline"} />
                  ))
                : null}
              {turn.question ? (
                <p className="pt-1 text-lg leading-snug font-medium">
                  {turn.question}
                </p>
              ) : null}
              {turn.chips ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Suggestions"
                >
                  {turn.chips.map((chip) => (
                    <Button
                      key={chip}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto rounded-full whitespace-normal text-left"
                      disabled={state === "offline"}
                      onClick={onChip ? () => onChip(chip) : undefined}
                    >
                      {chip}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

function ThreadCard({
  turn,
  disabled,
}: {
  turn: AssistantTurn;
  disabled: boolean;
}) {
  const card = turn.card!;
  const a = t().actions;

  if (card.kind === "opportunity") return <OpportunityCard data={card} />;

  if (card.kind === "score") {
    return (
      <CardShell title={card.title} state={card.state} variant="instrument">
        <ScoreBreakdown
          weighted={card.weighted}
          confidence={card.confidence}
          hardConstraint={card.hardConstraint}
          components={card.components}
        />
      </CardShell>
    );
  }

  if (card.kind === "approval") {
    // Ceremonial and NEUTRAL: solemnity comes from space and composition.
    // Warning styling is reserved for real risk (an unverified claim).
    return (
      <CardShell title={card.title} state="proposed" variant="ceremonial">
        <p className="text-muted-foreground mb-4 flex items-start gap-2 text-sm">
          <ShieldCheck
            aria-hidden="true"
            className="text-primary mt-0.5 size-4 shrink-0"
          />
          {t().approval.reassure}
        </p>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <CardField label="Action" wide>
            {card.action}
          </CardField>
          <CardField label="Contenu">{card.detail}</CardField>
          <CardField label="Destination">{card.destination}</CardField>
        </dl>
        {card.blocked ? (
          <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
            <AlertTriangle
              aria-hidden="true"
              className="text-warning mt-0.5 size-3.5 shrink-0"
            />
            {t().approval.blockedReason}
          </p>
        ) : null}
        {/* Decline is first and at least as prominent as approve (equal
            weight): approving an external action is never the easy default. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm">
            {a.decline}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={card.blocked || disabled}
          >
            {a.approve}
          </Button>
        </div>
      </CardShell>
    );
  }

  // understanding / evidence — field cards.
  // Rejected: recessed register — compact and set aside via hierarchy and a
  // dashed border, never via low-contrast text. Restore is the only action.
  if (card.state === "rejected") {
    return (
      <CardShell
        title={card.title}
        state="rejected"
        variant="recessed"
        className="w-full max-w-[44rem]"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-muted-foreground text-sm">
            {card.fields
              .map((f) => f.value)
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Button type="button" variant="ghost" size="sm" disabled={disabled}>
            {a.restore}
          </Button>
        </div>
      </CardShell>
    );
  }

  // Utility cards cap at 44rem while important moments (hero, score,
  // approval) span the full thread — the width alternation is the rhythm.
  const variant = card.kind === "evidence" ? "document" : "quiet";
  const railClass =
    card.kind === "evidence"
      ? card.state === "needs_review"
        ? " border-l-warning/70"
        : " border-l-primary/30"
      : "";
  return (
    <CardShell
      title={card.title}
      state={card.state}
      variant={variant}
      className={"w-full max-w-[44rem]" + railClass}
      actions={
        <>
          <Button type="button" size="sm" disabled={disabled}>
            {a.confirm}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            {a.correct}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled}>
            {a.ignore}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled}>
            {a.goDeeper}
          </Button>
        </>
      }
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {card.fields.map((f) => (
          <CardField
            key={f.label}
            label={f.label}
            warn={f.warn}
            chips={f.chips}
            wide={f.wide}
          >
            {f.value}
          </CardField>
        ))}
      </dl>
    </CardShell>
  );
}
