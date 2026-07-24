"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { setTrackingAction, untrackAction } from "@/lib/tracking/actions";
import {
  TRACKING_STAGES,
  type Tracking,
  type TrackingStage,
} from "@/lib/tracking/logic";

/**
 * Per-opportunity CRM tracking: pick the pipeline stage, jot a private note and
 * an optional follow-up date, or remove the opportunity from the pipeline. All
 * private, owner-scoped, deterministic — nothing is sent anywhere. State is
 * initialised from the loaded tracking and is the source of truth after mount
 * (no prop→state effect sync).
 */
export function TrackingPanel({
  opportunityId,
  tracking,
}: {
  opportunityId: string;
  tracking: Tracking | null;
}) {
  const router = useRouter();
  const copy = t().opportunities.tracking;
  const [stage, setStage] = useState<TrackingStage>(tracking?.stage ?? "saved");
  const [note, setNote] = useState(tracking?.note ?? "");
  const [followUp, setFollowUp] = useState(tracking?.followUpOn ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function run(fn: () => Promise<{ ok: boolean }>) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(copy.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setError(copy.error);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={copy.section}
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
    >
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {copy.section}
      </h2>
      <p className="text-muted-foreground text-xs">{copy.note}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="tracking-stage" className="text-xs font-medium">
            {copy.stageLabel}
          </label>
          <select
            id="tracking-stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as TrackingStage)}
            disabled={busy}
            className="border-input bg-background rounded-lg border p-2 text-sm"
          >
            {TRACKING_STAGES.map((s) => (
              <option key={s} value={s}>
                {copy.stages[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tracking-followup" className="text-xs font-medium">
            {copy.followUpLabel}
          </label>
          <input
            id="tracking-followup"
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            disabled={busy}
            className="border-input bg-background rounded-lg border p-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tracking-note" className="text-xs font-medium">
          {copy.noteLabel}
        </label>
        <textarea
          id="tracking-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          maxLength={4000}
          rows={3}
          placeholder={copy.notePlaceholder}
          className="border-input bg-background w-full min-w-0 rounded-lg border p-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          aria-busy={busy || undefined}
          className={busy ? "pointer-events-none opacity-60" : undefined}
          onClick={() =>
            void run(() =>
              setTrackingAction({
                opportunityId,
                stage,
                note,
                followUpOn: followUp === "" ? null : followUp,
              }),
            )
          }
        >
          {saved ? copy.saved : copy.save}
        </Button>
        {tracking ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => untrackAction({ opportunityId }))}
          >
            {copy.untrack}
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
