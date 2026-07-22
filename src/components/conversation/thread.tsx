"use client";

import { AlertTriangle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardShell, CardField } from "@/components/cards/card-shell";
import { OpportunityCard } from "@/components/cards/opportunity-card";
import { ScoreBreakdown } from "@/components/cards/score-card";
import { t } from "@/lib/copy";
import type { AssistantTurn, Turn } from "@/lib/ux/conversation-types";
import type { PreviewState } from "@/lib/ux/mock-conversation";

/**
 * The conversation thread — the primary surface. Prop-driven (takes `turns`),
 * so real Phase 1-4 features feed it real data; the UX Preview feeds mock
 * data. Assistant turns render at most one important question and at most one
 * card. New turns/cards announce via the polite live region.
 */
export function Thread({
  turns,
  state,
}: {
  turns: Turn[];
  state: PreviewState;
}) {
  const copy = t();

  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Chargement de la conversation"
        className="flex flex-col gap-4"
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
    <div className="flex flex-col gap-4">
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
        className="flex flex-col gap-4"
        aria-label="Conversation"
        aria-live="polite"
      >
        {turns.map((turn) =>
          turn.role === "user" ? (
            <li
              key={turn.id}
              className="bg-secondary text-secondary-foreground ml-auto max-w-[80%] rounded-xl rounded-br-sm px-4 py-2 text-[15px]"
            >
              {turn.text}
            </li>
          ) : (
            <li key={turn.id} className="flex flex-col gap-3">
              <p className="text-[15px] leading-relaxed">{turn.text}</p>
              {turn.card ? (
                <ThreadCard turn={turn} disabled={state === "offline"} />
              ) : null}
              {turn.question ? (
                <p className="text-[15px] font-medium">{turn.question}</p>
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
                      className="rounded-full"
                      disabled={state === "offline"}
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
      <CardShell title={card.title} state={card.state}>
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
    return (
      <CardShell
        title={card.title}
        state="proposed"
        className="border-warning/40"
      >
        <p className="text-muted-foreground mb-3 text-sm">
          {t().approval.reassure}
        </p>
        <dl>
          <CardField label="Action">{card.action}</CardField>
          <CardField label="Contenu">{card.detail}</CardField>
          <CardField label="Destination">{card.destination}</CardField>
        </dl>
        {card.blocked ? (
          <p className="text-muted-foreground mt-3 text-xs">
            {t().approval.blockedReason}
          </p>
        ) : null}
        {/* Decline is first and at least as prominent as approve (equal
            weight): approving an external action is never the easy default. */}
        <div className="mt-4 flex flex-wrap gap-2">
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

  // understanding / evidence — field cards with the four core actions.
  // A rejected card offers only Restore (never a dead end).
  const actions =
    card.state === "rejected" ? (
      <Button type="button" variant="outline" size="sm" disabled={disabled}>
        {a.restore}
      </Button>
    ) : (
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
    );

  return (
    <CardShell title={card.title} state={card.state} actions={actions}>
      <dl>
        {card.fields.map((f) => (
          <CardField key={f.label} label={f.label} warn={f.warn}>
            {f.value}
          </CardField>
        ))}
      </dl>
    </CardShell>
  );
}
