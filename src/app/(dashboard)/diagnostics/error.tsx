"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DiagnosticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("diagnostics error digest:", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-semibold">Diagnostics unavailable</h1>
      <p className="text-muted-foreground text-sm">
        Workflow runs could not be loaded. Retry, and check that the local
        Supabase stack is running.
        {error.digest ? ` (Reference: ${error.digest})` : null}
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
