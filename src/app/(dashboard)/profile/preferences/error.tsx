"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

export default function PreferencesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("preferences error digest:", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-semibold">{t().preferences.title}</h1>
      <p className="text-muted-foreground text-sm">
        {t().preferences.error}
        {error.digest ? ` (Référence : ${error.digest})` : null}
      </p>
      <Button onClick={reset} variant="outline">
        {t().actions.retry}
      </Button>
    </div>
  );
}
