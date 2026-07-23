import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";

/**
 * Language input + send — the standing invitation to talk. Static in the UX
 * Preview (no submission). Labelled textarea; send is a real button with an
 * accessible name; the whole surface carries the focus ring.
 */
export function Composer({ disabled }: { disabled?: boolean }) {
  const copy = t();
  return (
    <form
      className="border-border bg-card focus-within:ring-ring/60 flex items-end gap-2 rounded-2xl border p-3 shadow-floating focus-within:ring-2"
      aria-label="Composer un message"
    >
      <Label htmlFor="ux-composer" className="sr-only">
        {copy.composer.label}
      </Label>
      <textarea
        id="ux-composer"
        rows={2}
        placeholder={copy.composer.placeholder}
        disabled={disabled}
        className="text-foreground placeholder:text-muted-foreground max-h-40 min-h-14 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none disabled:opacity-60"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled}
        aria-label={copy.actions.send}
        className="rounded-full"
      >
        <SendHorizontal aria-hidden="true" />
      </Button>
    </form>
  );
}
