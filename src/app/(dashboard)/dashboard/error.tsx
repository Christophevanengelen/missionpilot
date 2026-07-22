"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sanitized client surface: the digest is safe to show; details stay in
    // server logs (src/lib/observability, wired in J4).
    console.error("dashboard error digest:", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        The dashboard could not be loaded. Retry, and if the problem persists,
        check the workflow diagnostics.
        {error.digest ? ` (Reference: ${error.digest})` : null}
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
