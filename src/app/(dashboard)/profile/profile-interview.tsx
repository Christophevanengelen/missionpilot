"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  publishVersionAction,
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
  latestVersionNumber,
}: {
  claims: LivingClaim[];
  evidence: LivingEvidence[];
  links: LivingLink[];
  latestVersionNumber: number | null;
}) {
  const copy = t().interview;
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
  // Publication state: seeded server-side, then updated from the action's
  // OWN return (same authority rule as the living snapshot).
  const [latestVersion, setLatestVersion] = useState(latestVersionNumber);
  const [versionNotice, setVersionNotice] = useState<string | null>(null);

  // Action-return protocol: the DISPLAYED state comes from the Server
  // Action's own return (the canonical living snapshot re-read after the
  // mutation) — user feedback never depends on an RSC patch being
  // committed. Props only SEED the state at mount (a real return to the
  // page remounts and re-reads from the database).
  const [living, setLiving] = useState<LivingState>({
    claims,
    evidence,
    links,
  });
  // The action-returned snapshot is AUTHORITATIVE while mounted: a late RSC
  // patch (from a previous mutation's revalidation) can only carry data
  // OLDER than or equal to the newest action return, so re-syncing from
  // props here would let a stale patch clobber fresher state — the exact
  // regression this protocol eliminates (reproduced 10/10 under 4x CPU
  // throttle before this guard). A real return to the page remounts the
  // component and re-reads from the database.
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

  // aria-busy instead of native `disabled` on every mutation control: a
  // disabled attribute landing in a re-render between hit-test and dispatch
  // swallows the click natively (dead click, reproduced 10/10 under 4x CPU
  // throttle). The synchronous ref lock already serializes — an extra click
  // is dropped before any server call, with no misleading message.
  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  async function run(
    op: () => Promise<{
      ok: boolean;
      error?: string;
      snapshot?: LivingState;
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
      // Render the state the server just re-read — immediately.
      if (result.snapshot) {
        setLiving(result.snapshot);
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
      // Apply EACH successful sub-action's snapshot immediately: a failure
      // later in the chain must still show what was committed — including
      // the proposed evidence and its panel «Confirmer» recovery.
      if (created.snapshot) setLiving(created.snapshot);
      // The form IS the user's explicit assertion — confirm it, then attach.
      const confirmed = await decideEvidenceAction({
        evidenceId: created.data.evidenceId,
        to: "confirmed",
      });
      if (!confirmed.ok) throw new Error(confirmed.error);
      if (confirmed.snapshot) setLiving(confirmed.snapshot);
      if (forClaim) {
        const linked = await attachEvidenceAction({
          claimId: forClaim.id,
          evidenceId: created.data.evidenceId,
        });
        if (!linked.ok) throw new Error(linked.error);
        if (linked.snapshot) setLiving(linked.snapshot);
      }
      setMode({ type: "normal" });
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message
          ? error.message
          : "L'opération n'a pas abouti. Réessayez.",
      );
      // Committed sub-actions already applied their snapshots above, so the
      // surface shows exactly what exists — recovery happens in the panel.
    } finally {
      release();
    }
  }

  function detach(linkId: string) {
    void run(() => detachEvidenceAction({ linkId })).catch(() => undefined);
  }

  // Freeze the confirmed state into a version (PR A contract, unchanged).
  // Honest outcomes: created / no-op (consecutive-difference rule) /
  // transport-unknown (publication is idempotent, retrying is safe).
  async function publishVersion() {
    if (!acquire()) return;
    setFeedback(null);
    setVersionNotice(null);
    try {
      const result = await publishVersionAction();
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }
      if (result.data.created) {
        setLatestVersion(result.data.versionNumber);
        setVersionNotice(
          copy.panel.versions.published(
            result.data.versionNumber,
            result.data.summary,
          ),
        );
      } else {
        // The RPC's no-op returns the HEAD version — syncing the displayed
        // number from the action's own return respects the authority rule
        // (matters after an uncertain transport retry).
        setLatestVersion(result.data.versionNumber);
        setVersionNotice(copy.panel.versions.noop(result.data.versionNumber));
      }
    } catch {
      setFeedback(copy.panel.versions.unknown);
    } finally {
      release();
    }
  }

  // ----- rendering ---------------------------------------------------------

  const renderCard = (turn: AssistantTurn) => {
    const card = turn.card;
    if (!card || card.kind !== "understanding") return null;
    // Resolve from the AUTHORITATIVE living state (action returns), never
    // from possibly-stale props.
    const claim = living.claims.find((c) => c.id === card.id);
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
                {...busyProps}
                onClick={() => decide(claim.id, "confirmed")}
              >
                {a.confirm}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                {...busyProps}
                onClick={() => setMode({ type: "correct", claim })}
              >
                {a.correct}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                {...busyProps}
                onClick={() => decide(claim.id, "rejected")}
              >
                {a.ignore}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                {...busyProps}
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
              {...busyProps}
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

  const rejectedClaims = living.claims.filter((c) => c.state === "rejected");
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
                {...busyProps}
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
        {living.evidence.length === 0 ? (
          <p className="text-muted-foreground text-xs">{copy.panel.empty}</p>
        ) : (
          living.evidence.map((e) => {
            const activeLinks = living.links.filter(
              (l) => l.evidence_id === e.id,
            );
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
                    {...busyProps}
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
                        const claim = living.claims.find(
                          (c) => c.id === l.claim_id,
                        );
                        return claim
                          ? copy.panel.attachedTo(claimValueLabel(claim))
                          : copy.panel.attachedTo("…");
                      })()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      {...busyProps}
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
          {...busyProps}
          onClick={() => setMode({ type: "evidence_form" })}
        >
          {copy.panel.addEvidence}
        </Button>
      </section>

      <section
        aria-label={copy.panel.versions.title}
        className="border-border/60 flex flex-col gap-2 border-t pt-4"
      >
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.panel.versions.title}
        </h3>
        <p className="text-muted-foreground text-xs">
          {latestVersion !== null
            ? copy.panel.versions.current(latestVersion)
            : copy.panel.versions.none}
        </p>
        {living.claims.some((c) => c.state === "confirmed") ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              {...busyProps}
              onClick={() => void publishVersion()}
            >
              {copy.panel.versions.publish}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            {copy.panel.versions.needConfirmed}
          </p>
        )}
        {versionNotice ? (
          <p role="status" className="text-sm">
            {versionNotice}
          </p>
        ) : null}
        <p>
          <Link
            href="/profile/history"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {copy.panel.history}
          </Link>
        </p>
      </section>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 gap-12">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col">
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
