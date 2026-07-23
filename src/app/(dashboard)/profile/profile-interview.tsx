"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/conversation/thread";
import { Composer } from "@/components/conversation/composer";
import { ContextSummary } from "@/components/context/context-summary";
import { StateBadge } from "@/components/context/state-badge";
import { CardShell, CardField } from "@/components/cards/card-shell";
import {
  EvidenceFormCard,
  type EvidenceFormValues,
} from "@/components/cards/evidence-form-card";
import { t } from "@/lib/copy";
import type { AssistantTurn } from "@/lib/ux/conversation-types";
import {
  claimValueLabel,
  foundationProgress,
  nextStep,
  parseAnswer,
  type LivingClaim,
  type LivingEvidence,
  type LivingLink,
  type LivingState,
} from "@/lib/profile/interview";
import {
  buildFacts,
  buildTurns,
  stepQuestion,
} from "@/lib/profile/interview-projection";
import {
  attachEvidenceAction,
  createEvidenceAction,
  decideClaimAction,
  decideEvidenceAction,
  detachEvidenceAction,
  submitClaimAction,
} from "@/lib/profile/actions";

type Mode =
  | { type: "normal" }
  | { type: "correct"; claim: LivingClaim }
  | { type: "evidence_form"; forClaim?: LivingClaim }
  /** Post-foundation enrichment: an explicit extra ask chosen via chip. */
  | { type: "ask_extra"; kind: "skill" | "achievement" };

export function ProfileInterview({
  claims,
  evidence,
  links,
}: {
  claims: LivingClaim[];
  evidence: LivingEvidence[];
  links: LivingLink[];
}) {
  const copy = t().interview;
  const router = useRouter();
  // Synchronous lock (ref) + UI mirror (state): the ref is authoritative and
  // immune to stale closures — two near-simultaneous submits can never both
  // enter a mutation, even before React re-renders the disabled state.
  const inFlightRef = useRef(false);
  const [inFlight, setInFlight] = useState(false);
  const acquire = () => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setInFlight(true);
    return true;
  };
  const release = () => {
    inFlightRef.current = false;
    setInFlight(false);
  };
  const [mode, setMode] = useState<Mode>({ type: "normal" });
  const [suggestDismissed, setSuggestDismissed] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const living: LivingState = useMemo(
    () => ({ claims, evidence, links }),
    [claims, evidence, links],
  );
  const step = useMemo(() => nextStep(living), [living]);
  const turns = useMemo(() => buildTurns(living, step), [living, step]);
  const facts = useMemo(() => buildFacts(living), [living]);
  const foundation = useMemo(() => foundationProgress(living), [living]);

  // Every control gates on `busy`: the in-flight lock covers the WHOLE
  // mutation round-trip (double-submit protection). The UI update itself
  // arrives WITH the action response (revalidatePath in the actions) — no
  // client-side refresh, hence no race with navigation prefetches and no
  // possible stale-snapshot commit.
  const busy = inFlight;

  async function run(
    op: () => Promise<{
      ok: boolean;
      error?: string;
      revalidated?: boolean;
    }>,
  ) {
    if (!acquire()) return;
    setFeedback(null);
    try {
      const result = await op();
      if (!result.ok) {
        setFeedback(result.error ?? "Réessayez.");
        throw new Error("action failed");
      }
      // SINGLE explicit fallback: only when the server revalidation step
      // failed does the client refresh — never concurrently with it.
      if (result.revalidated === false) {
        router.refresh();
      }
      // Keyboard/AT continuity: the decided card unmounts when the action
      // response lands — hand focus to the composer, which persists.
      document.getElementById("ux-composer")?.focus();
    } finally {
      release();
    }
  }

  // ----- conversational actions -------------------------------------------

  const activeAskKind =
    mode.type === "correct"
      ? mode.claim.kind
      : mode.type === "ask_extra"
        ? mode.kind
        : step.type === "ask"
          ? step.kind
          : step.type === "deepen"
            ? step.claim.kind
            : null;

  async function handleSend(text: string) {
    if (!activeAskKind) return;
    const parsed = parseAnswer(activeAskKind, text);
    if (!parsed.ok) {
      setFeedback(copy.answerErrors[parsed.reason]);
      throw new Error("invalid answer");
    }
    const claimToSupersede =
      mode.type === "correct"
        ? mode.claim.id
        : step.type === "deepen"
          ? step.claim.id
          : undefined;
    await run(() =>
      submitClaimAction({
        kind: activeAskKind,
        value: parsed.value,
        claimToSupersede,
      }),
    );
    setMode({ type: "normal" });
  }

  function decide(
    claimId: string,
    to: "confirmed" | "needs_review" | "rejected" | "proposed",
  ) {
    void run(() => decideClaimAction({ claimId, to })).catch(() => undefined);
  }

  async function handleEvidenceSubmit(values: EvidenceFormValues) {
    const forClaim =
      mode.type === "evidence_form"
        ? mode.forClaim
        : step.type === "suggest_evidence"
          ? step.claim
          : undefined;
    if (!acquire()) return;
    try {
      setFeedback(null);
      const source = values.sourceReference.trim();
      const created = await createEvidenceAction({
        type: "achievement",
        title: values.title.trim(),
        statement: values.statement.trim(),
        organization: values.organization.trim() || undefined,
        rolePlayed: values.rolePlayed.trim() || undefined,
        startDate: values.periodStart || undefined,
        endDate: values.periodEnd || undefined,
        metrics: values.metric.trim()
          ? { principale: values.metric.trim() }
          : {},
        tags: values.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20),
        sourceType: source
          ? /^https?:\/\//i.test(source)
            ? "url"
            : "document"
          : "user_stated",
        sourceReference: source || undefined,
        verificationStatus: "user_confirmed",
      });
      if (!created.ok) throw new Error(created.error);
      let needsFallback = created.revalidated === false;
      // The form IS the user's explicit assertion — confirm it, then attach.
      const confirmed = await decideEvidenceAction({
        evidenceId: created.data.evidenceId,
        to: "confirmed",
      });
      if (!confirmed.ok) throw new Error(confirmed.error);
      needsFallback ||= confirmed.revalidated === false;
      if (forClaim) {
        const linked = await attachEvidenceAction({
          claimId: forClaim.id,
          evidenceId: created.data.evidenceId,
        });
        if (!linked.ok) throw new Error(linked.error);
        needsFallback ||= linked.revalidated === false;
      }
      if (needsFallback) {
        router.refresh();
      }
      setMode({ type: "normal" });
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message
          ? error.message
          : "L'opération n'a pas abouti. Réessayez.",
      );
      // Partial records are already visible: each SUCCESSFUL sub-action
      // revalidated the surface with its own response.
    } finally {
      release();
    }
  }

  function detach(linkId: string) {
    void run(() => detachEvidenceAction({ linkId })).catch(() => undefined);
  }

  // ----- rendering ---------------------------------------------------------

  const renderCard = (turn: AssistantTurn) => {
    const card = turn.card;
    if (!card || card.kind !== "understanding") return null;
    const claim = claims.find((c) => c.id === card.id);
    if (!claim) return null;
    const a = t().actions;
    return (
      <CardShell
        title={card.title}
        state={claim.state}
        className="w-full max-w-[44rem]"
        actions={
          claim.state === "proposed" ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => decide(claim.id, "confirmed")}
              >
                {a.confirm}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setMode({ type: "correct", claim })}
              >
                {a.correct}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => decide(claim.id, "rejected")}
              >
                {a.ignore}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => decide(claim.id, "needs_review")}
              >
                {a.goDeeper}
              </Button>
            </>
          ) : claim.state === "needs_review" ? (
            // Single resolution path after Approfondir: answer the follow-up
            // (replacement proposal to confirm). Ignorer stays as the
            // owner-defined escape.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => decide(claim.id, "rejected")}
            >
              {a.ignore}
            </Button>
          ) : undefined
        }
      >
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {card.fields.map((f) => (
            <CardField key={f.label} label={f.label} wide>
              {f.value}
            </CardField>
          ))}
        </dl>
      </CardShell>
    );
  };

  const rejectedClaims = claims.filter((c) => c.state === "rejected");
  const showEvidenceForm =
    mode.type === "evidence_form" ||
    (step.type === "suggest_evidence" && suggestDismissed !== step.claim.id);
  const composerActive = activeAskKind !== null;
  const question = stepQuestion(step);

  const panel = (
    <div className="flex flex-col gap-6">
      <ContextSummary facts={facts} foundation={foundation} />

      {rejectedClaims.length > 0 ? (
        <section aria-label="Éléments écartés" className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Écartés
          </h3>
          {rejectedClaims.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-muted-foreground truncate">
                {claimValueLabel(c)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => decide(c.id, "proposed")}
              >
                {t().actions.restore}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-label={copy.panel.evidence} className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.panel.evidence}
        </h3>
        {evidence.length === 0 ? (
          <p className="text-muted-foreground text-xs">{copy.panel.empty}</p>
        ) : (
          evidence.map((e) => {
            const activeLinks = links.filter((l) => l.evidence_id === e.id);
            return (
              <div key={e.id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate">{e.title}</span>
                  <StateBadge
                    state={e.state}
                    className="shrink-0 px-1.5 text-[11px]"
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {e.verification_status === "user_confirmed"
                    ? copy.declaredBy
                    : e.verification_status}
                  {e.role_played ? ` · ${e.role_played}` : ""}
                </span>
                {e.state === "proposed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        decideEvidenceAction({
                          evidenceId: e.id,
                          to: "confirmed",
                        }),
                      ).catch(() => undefined)
                    }
                  >
                    {t().actions.confirm}
                  </Button>
                ) : null}
                {activeLinks.map((l) => (
                  <div key={l.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      {(() => {
                        const claim = claims.find((c) => c.id === l.claim_id);
                        return claim
                          ? copy.panel.attachedTo(claimValueLabel(claim))
                          : copy.panel.attachedTo("…");
                      })()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => detach(l.id)}
                    >
                      {copy.panel.detach}
                    </Button>
                  </div>
                ))}
              </div>
            );
          })
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setMode({ type: "evidence_form" })}
        >
          {copy.panel.addEvidence}
        </Button>
      </section>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-12">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="mb-4 flex justify-end xl:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Contexte"
            aria-expanded={contextOpen}
            aria-controls="profile-context"
            onClick={() => setContextOpen((v) => !v)}
          >
            <PanelRightOpen aria-hidden="true" />
            <span className="hidden sm:inline">Contexte</span>
          </Button>
        </div>
        {contextOpen ? (
          <div
            id="profile-context"
            className="border-border bg-surface-raised mb-6 rounded-xl border p-4 xl:hidden"
          >
            {panel}
          </div>
        ) : null}

        <Thread
          turns={turns}
          state="populated"
          renderCard={renderCard}
          onChip={(chip) => {
            if (chip === copy.panel.addEvidence) {
              setMode({ type: "evidence_form" });
            } else if (chip === copy.questions.skill) {
              setMode({ type: "ask_extra", kind: "skill" });
            } else if (chip === copy.questions.achievement) {
              setMode({ type: "ask_extra", kind: "achievement" });
            }
          }}
        />

        {mode.type === "correct" ? (
          <p className="text-muted-foreground mt-4 text-sm">
            {copy.correctPrompt}{" "}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode({ type: "normal" })}
            >
              Annuler
            </Button>
          </p>
        ) : null}

        {showEvidenceForm ? (
          <div className="mt-6">
            <EvidenceFormCard
              busy={busy}
              attachToTitle={
                step.type === "suggest_evidence"
                  ? claimValueLabel(step.claim)
                  : mode.type === "evidence_form" && mode.forClaim
                    ? claimValueLabel(mode.forClaim)
                    : undefined
              }
              onSubmit={handleEvidenceSubmit}
              onCancel={() => {
                if (step.type === "suggest_evidence") {
                  setSuggestDismissed(step.claim.id);
                }
                setMode({ type: "normal" });
              }}
            />
          </div>
        ) : null}

        {feedback ? (
          <p
            role="alert"
            data-testid="action-feedback"
            className="text-destructive mt-4 text-sm"
          >
            {feedback}
          </p>
        ) : null}

        <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-(--background) via-(--background)/95 to-transparent pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Composer
            disabled={!composerActive}
            busy={busy}
            placeholder={
              mode.type === "correct"
                ? copy.correctPrompt
                : mode.type === "ask_extra"
                  ? copy.questions[mode.kind]
                  : (question ?? undefined)
            }
            onSend={handleSend}
          />
        </div>
      </div>

      <aside
        aria-label="Panneau de contexte"
        className="border-border/60 hidden h-fit w-72 shrink-0 border-l pl-6 xl:sticky xl:top-24 xl:block"
      >
        {panel}
      </aside>
    </div>
  );
}
