"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import {
  tailorApplicationAction,
  type TailorRunResult,
} from "@/lib/matching/tailor-actions";
import type { StoredDraft } from "@/lib/matching/tailor-logic";

/**
 * "Prepare, don't send": generate a tailored, GROUNDED cover-letter draft +
 * matching highlights for this opportunity, shown in an EDITABLE field the
 * user completes (the [brackets] are metrics to fill) and copies — then sends
 * themselves. MissionPilot never submits anything. Same double-submit
 * conventions as the rest of the app.
 */
export function ApplicationDraftPanel({
  opportunityId,
  draft,
}: {
  opportunityId: string;
  draft: StoredDraft | null;
}) {
  const router = useRouter();
  const copy = t().opportunities.application;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inFlightRef = useRef(false);
  // Uncontrolled textarea (defaultValue + a key tied to the draft) so a
  // regenerated draft resets it, WITHOUT syncing prop→state in an effect.
  const letterRef = useRef<HTMLTextAreaElement>(null);

  async function generate() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result: TailorRunResult = await tailorApplicationAction({
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

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letterRef.current?.value ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(copy.errors.generic);
    }
  }

  return (
    <section
      aria-label={copy.section}
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.section}
        </h2>
      </div>
      <p className="text-muted-foreground text-xs">{copy.note}</p>

      {draft ? (
        <>
          {draft.needs_review ? (
            <p
              role="note"
              className="border-warning/40 bg-warning/10 text-foreground/80 rounded-lg border px-3 py-2 text-xs"
            >
              {copy.needsReview}
            </p>
          ) : null}
          {draft.highlights.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-muted-foreground text-xs font-medium">
                {copy.highlightsLabel}
              </h3>
              <ul className="list-disc pl-4 text-xs">
                {draft.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="cover-letter"
              className="text-muted-foreground text-xs font-medium"
            >
              {copy.coverLabel}
            </label>
            <textarea
              id="cover-letter"
              key={draft.input_hash}
              ref={letterRef}
              defaultValue={draft.cover_letter}
              rows={14}
              className="border-input bg-background w-full min-w-0 rounded-lg border p-3 text-sm"
            />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">{copy.empty}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={draft ? "outline" : "default"}
          aria-busy={busy || undefined}
          className={busy ? "pointer-events-none opacity-60" : undefined}
          onClick={() => void generate()}
        >
          {busy ? copy.generating : draft ? copy.refreshCta : copy.button}
        </Button>
        {draft ? (
          <Button type="button" size="sm" variant="ghost" onClick={copyLetter}>
            {copied ? copy.copied : copy.copy}
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
