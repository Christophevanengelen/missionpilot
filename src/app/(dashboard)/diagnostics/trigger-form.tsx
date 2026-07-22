"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { triggerHealthCheck, type TriggerState } from "./actions";

const initialState: TriggerState = { ok: null, message: null };

export function TriggerForm() {
  const [state, formAction, isPending] = useActionState(
    triggerHealthCheck,
    initialState,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The button is disabled while pending, which drops keyboard focus to
  // <body>; restore it when the action settles so keyboard users stay where
  // they were (accessibility checklist: focus restitution after an error).
  useEffect(() => {
    if (state.message && document.activeElement === document.body) {
      buttonRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button ref={buttonRef} type="submit" disabled={isPending}>
        {isPending ? "Requesting…" : "Run health check"}
      </Button>
      {state.message ? (
        <p
          id="trigger-status"
          role="status"
          className={
            state.ok
              ? "text-muted-foreground text-sm"
              : "text-destructive text-sm font-medium"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
