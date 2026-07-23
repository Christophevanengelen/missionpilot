"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/copy";
import {
  importFromUrlAction,
  importPastedTextAction,
} from "@/lib/opportunity/actions";
import type { SourceBlockedReason } from "@/lib/opportunity/source-policy";

/**
 * Import a listing by pasting its text, with an optional source URL. The
 * textarea content is untrusted DATA — sent as-is to the action, which
 * normalizes it structurally. A URL, if given, is classified by the source
 * policy (NO server-side fetch — owner decision); a blocked source shows a
 * specific honest reason. Same double-submit conventions as the rest of the
 * app (synchronous ref lock + aria-busy). On success the user is taken to the
 * new opportunity's inspection screen.
 */
export function ImportForm() {
  const router = useRouter();
  const copy = t().opportunities;
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  async function submit() {
    if (inFlightRef.current) return;
    if (!text.trim()) {
      setError(copy.importEmpty);
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = url.trim()
        ? await importFromUrlAction({ url, rawText: text })
        : await importPastedTextAction({ rawText: text });
      if (!result.ok) {
        // A blocked URL carries a specific reason; otherwise the generic msg.
        const reason = (result as { blockedReason?: SourceBlockedReason })
          .blockedReason;
        setError(reason ? copy.urlBlocked[reason] : result.error);
        return;
      }
      router.push(`/opportunities/${result.data.opportunityId}`);
    } catch {
      setError(copy.importError);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Label htmlFor="listing-url">{copy.urlLabel}</Label>
      <Input
        id="listing-url"
        type="url"
        inputMode="url"
        placeholder={copy.urlPlaceholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <p className="text-muted-foreground text-xs">{copy.urlNote}</p>

      <Label htmlFor="paste-listing">{copy.importLabel}</Label>
      <textarea
        id="paste-listing"
        className="border-input bg-background min-h-40 w-full min-w-0 rounded-lg border p-3 text-sm"
        placeholder={copy.importPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" {...busyProps}>
          {copy.importButton}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
