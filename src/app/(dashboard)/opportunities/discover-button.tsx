"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import {
  discoverOpportunitiesAction,
  type DiscoveryResult,
} from "@/lib/discovery/actions";

/**
 * One-click auto-discovery: search the configured legal source with keywords
 * from the confirmed profile, import the results through the standard
 * pipeline, and report honestly (new vs already known; a specific reason when
 * discovery cannot run). Same double-submit conventions as the rest of the
 * app.
 */
export function DiscoverButton() {
  const router = useRouter();
  const copy = t().opportunities.discover;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  function describe(result: DiscoveryResult): {
    text: string;
    error: boolean;
  } {
    if (result.ok) {
      const partial =
        result.failedSearches > 0
          ? ` ${copy.partial(result.failedSearches)}`
          : "";
      return {
        text:
          copy.result(result.imported, result.duplicates, result.failed) +
          partial,
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
      const outcome = describe(await discoverOpportunitiesAction());
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
      <Button type="button" size="sm" onClick={() => void run()} {...busyProps}>
        {busy ? copy.searching : copy.button}
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
