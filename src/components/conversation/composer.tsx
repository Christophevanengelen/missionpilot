import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";

/**
 * Language input + send. Static in the UX Preview (no submission). Labelled
 * textarea; send is a real button with an accessible name.
 */
export function Composer({ disabled }: { disabled?: boolean }) {
  const copy = t();
  return (
    <form
      className="border-border bg-surface-raised flex items-end gap-2 rounded-xl border p-2"
      aria-label="Composer un message"
    >
      <Label htmlFor="ux-composer" className="sr-only">
        {copy.composer.label}
      </Label>
      <textarea
        id="ux-composer"
        rows={1}
        placeholder={copy.composer.placeholder}
        disabled={disabled}
        className="text-foreground placeholder:text-muted-foreground max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none disabled:opacity-60"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled}
        aria-label={copy.actions.send}
      >
        <SendHorizontal aria-hidden="true" />
      </Button>
    </form>
  );
}
