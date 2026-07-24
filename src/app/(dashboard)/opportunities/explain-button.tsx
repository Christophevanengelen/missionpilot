"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import {
  explainMatchesAction,
  type InsightRunResult,
} from "@/lib/matching/insight-actions";

/**
 * One-click "pourquoi ce match" analysis of the best-ranked offers
 * (cost-bounded, freshness-aware server-side). Honest report: analyzed vs
 * failed, or the specific reason the analysis cannot run. Same double-submit
 * conventions as the rest of the app.
 */
export function ExplainButton() {
  const router = useRouter();
  const copy = t().opportunities.insight;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  function describe(result: InsightRunResult): {
    text: string;
    error: boolean;
  } {
    if (result.ok) {
      return {
        text: copy.result(result.analyzed, result.failed),
        error: false,
      };
    }
    return { text: copy.errors[result.error], error: true };
  }

  async function run() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = describe(await explainMatchesAction());
      setMessage(outcome.text);
      setIsError(outcome.error);
      if (!outcome.error) router.refresh();
    } catch {
      setMessage(copy.errors.generic);
      setIsError(true);
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
        variant="outline"
        onClick={() => void run()}
        {...busyProps}
      >
        {busy ? copy.analyzing : copy.button}
      </Button>
      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className={isError ? "text-destructive text-sm" : "text-sm"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
