"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import {
  explainBreakdownAction,
  type BreakdownRunResult,
} from "@/lib/matching/breakdown-actions";

/**
 * Runs the on-demand per-requirement breakdown for this opportunity, then
 * refreshes so the server-rendered result appears. Honest reporting; same
 * double-submit conventions as the rest of the app. `hasResult` only changes
 * the button label (analyze vs re-analyze).
 */
export function BreakdownButton({
  opportunityId,
  hasResult,
}: {
  opportunityId: string;
  hasResult: boolean;
}) {
  const router = useRouter();
  const copy = t().opportunities.breakdown;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function run() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result: BreakdownRunResult = await explainBreakdownAction({
        opportunityId,
      });
      if (!result.ok) {
        setError(copy.errors[result.error]);
        return;
      }
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={hasResult ? "outline" : "default"}
        aria-busy={busy || undefined}
        className={busy ? "pointer-events-none opacity-60" : undefined}
        onClick={() => void run()}
      >
        {busy ? copy.analyzing : hasResult ? copy.refreshCta : copy.button}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
