"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";

/**
 * Language input + send — the standing invitation to talk. Static in the UX
 * Preview (no submission). Labelled textarea; send is a real button with an
 * accessible name; the whole surface carries the focus ring.
 */
export function Composer({
  disabled,
  busy,
  placeholder,
  onSend,
}: {
  disabled?: boolean;
  /** A submission is in flight — input stays, send is blocked. */
  busy?: boolean;
  placeholder?: string;
  /** Real product handler; without it the composer is a static artifact. */
  onSend?: (text: string) => void | Promise<void>;
}) {
  const copy = t();
  const [text, setText] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSend || busy) return;
    const value = text;
    try {
      await onSend(value);
    } catch {
      // The page surfaced its own feedback; keep the user's text intact.
      return;
    }
    setText("");
  };
  return (
    <form
      className="border-border bg-card focus-within:ring-ring/60 flex items-end gap-2 rounded-2xl border p-3 shadow-floating focus-within:ring-2"
      aria-label="Composer un message"
      onSubmit={onSend ? submit : undefined}
    >
      <Label htmlFor="ux-composer" className="sr-only">
        {copy.composer.label}
      </Label>
      <textarea
        id="ux-composer"
        rows={2}
        placeholder={placeholder ?? copy.composer.placeholder}
        disabled={disabled}
        value={onSend ? text : undefined}
        onChange={onSend ? (e) => setText(e.target.value) : undefined}
        onKeyDown={
          onSend
            ? (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit(e);
                }
              }
            : undefined
        }
        className="text-foreground placeholder:text-muted-foreground max-h-40 min-h-14 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none disabled:opacity-60"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || busy}
        aria-label={copy.actions.send}
        className="rounded-full"
      >
        <SendHorizontal aria-hidden="true" />
      </Button>
    </form>
  );
}
