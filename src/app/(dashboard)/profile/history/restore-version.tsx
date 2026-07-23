"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { restoreVersionAction } from "@/lib/profile/actions";

type Outcome =
  | { kind: "restored"; createdNumber: number; missingEvidence: number }
  | { kind: "noop" }
  | { kind: "error" }
  /** Transport-level failure: the server's decision is UNKNOWN — never
   *  claim "nothing was modified" in that case. */
  | { kind: "unknown" };

/**
 * Triggers the EXISTING restore contract (PR A) and explains it honestly:
 * the working profile is replaced AND a new traceable version is created;
 * every existing version is kept. The `created=false` no-op (content
 * already identical to the latest version) is reported as "nothing was
 * changed". Same double-submit conventions as the interview: synchronous
 * ref lock + aria-busy (no native disabled on the mutation control).
 */
export function RestoreVersion({
  versionId,
  versionNumber,
}: {
  versionId: string;
  versionNumber: number;
}) {
  const router = useRouter();
  const copy = t().history;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  async function restore() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await restoreVersionAction({ versionId });
      if (!result.ok) {
        setOutcome({ kind: "error" });
        return;
      }
      if (!result.data.created) {
        setOutcome({ kind: "noop" });
      } else {
        setOutcome({
          kind: "restored",
          createdNumber: result.data.versionNumber,
          missingEvidence: result.data.missingEvidence,
        });
      }
      setConfirming(false);
    } catch {
      // The POST itself failed (offline, transport): the server's decision
      // is unknown — say so honestly, never "nothing was modified".
      setOutcome({ kind: "unknown" });
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  if (outcome?.kind === "restored") {
    return (
      <div role="status" className="flex w-full flex-col gap-2">
        <p className="text-sm">
          {copy.restore.success(versionNumber, outcome.createdNumber)}
        </p>
        {outcome.missingEvidence > 0 ? (
          <p className="text-muted-foreground text-sm">
            {copy.restore.missingEvidence(outcome.missingEvidence)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/profile")}
          >
            {copy.backToProfile}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/profile/history")}
          >
            {copy.backToHistory}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!confirming ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOutcome(null);
              setConfirming(true);
            }}
          >
            {copy.restoreAction}
          </Button>
        </div>
      ) : (
        <div className="border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm">{copy.restore.warning}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              {...busyProps}
              onClick={() => setConfirming(false)}
            >
              {copy.restore.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              {...busyProps}
              onClick={() => void restore()}
            >
              {copy.restore.confirm}
            </Button>
          </div>
        </div>
      )}
      {outcome?.kind === "noop" ? (
        <p role="status" className="text-muted-foreground text-sm">
          {copy.restore.noop}
        </p>
      ) : null}
      {outcome?.kind === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {copy.restore.error}
        </p>
      ) : null}
      {outcome?.kind === "unknown" ? (
        <p role="alert" className="text-destructive text-sm">
          {copy.restore.unknown}
        </p>
      ) : null}
    </div>
  );
}
