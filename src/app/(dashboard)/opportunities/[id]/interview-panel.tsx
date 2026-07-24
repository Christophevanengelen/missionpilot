"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import {
  prepareInterviewAction,
  type InterviewRunResult,
} from "@/lib/matching/interview-actions";
import type { StoredBrief } from "@/lib/matching/interview-logic";

/**
 * Interview preparation for this opportunity: likely questions mapped to the
 * candidate's real evidence, plus talking points. Preparation material the
 * human reviews — never a script of fabricated claims, never a promise about
 * the outcome. Same double-submit conventions as the rest of the app.
 */
export function InterviewBriefPanel({
  opportunityId,
  brief,
}: {
  opportunityId: string;
  brief: StoredBrief | null;
}) {
  const router = useRouter();
  const copy = t().opportunities.interview;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function run() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result: InterviewRunResult = await prepareInterviewAction({
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
    <section
      aria-label={copy.section}
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
    >
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {copy.section}
      </h2>
      <p className="text-muted-foreground text-xs">{copy.note}</p>

      {brief ? (
        <>
          {brief.needs_review ? (
            <p
              role="note"
              className="border-warning/40 bg-warning/10 text-foreground/80 rounded-lg border px-3 py-2 text-xs"
            >
              {copy.needsReview}
            </p>
          ) : null}
          {brief.questions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-medium">
                {copy.questionsLabel}
              </h3>
              <ol className="flex flex-col gap-2">
                {brief.questions.map((q, i) => (
                  <li
                    key={i}
                    className="border-border flex flex-col gap-1 border-b border-dashed pb-2 last:border-0"
                  >
                    <p className="text-sm font-medium">{q.question}</p>
                    <p className="text-muted-foreground text-xs">{q.angle}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {brief.talkingPoints.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-muted-foreground text-xs font-medium">
                {copy.talkingPointsLabel}
              </h3>
              <ul className="list-disc pl-4 text-xs">
                {brief.talkingPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground text-xs">{copy.empty}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={brief ? "outline" : "default"}
          aria-busy={busy || undefined}
          className={busy ? "pointer-events-none opacity-60" : undefined}
          onClick={() => void run()}
        >
          {busy ? copy.preparing : brief ? copy.refreshCta : copy.button}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
