import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CARD_STATE_STYLE, type CardState } from "@/lib/ux/card-state";
import { t, type Locale } from "@/lib/copy";

/**
 * Renders a card lifecycle state as a labelled badge. State is conveyed by
 * TEXT (never color alone); the token is language-neutral, the label is
 * localized.
 */
export function StateBadge({
  state,
  locale,
}: {
  state: CardState;
  locale?: Locale;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", CARD_STATE_STYLE[state])}
      data-state={state}
    >
      {t(locale).cardStates[state]}
    </Badge>
  );
}
