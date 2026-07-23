import { t } from "@/lib/copy";
import type { EligibilityGate } from "@/lib/matching/hard-constraints";

// Meaning is carried by the tint, the border, AND the text label (never color
// alone). Text stays high-contrast `text-foreground` so the badge meets WCAG AA
// on the light tint (a saturated colored text on a /10 tint fails contrast).
const STYLES: Record<EligibilityGate, string> = {
  eligible: "border-success/50 bg-success/10 text-foreground",
  review: "border-warning/50 bg-warning/10 text-foreground/80",
  excluded: "border-destructive/60 bg-destructive/10 text-foreground",
};

/**
 * Compact eligibility badge for the deterministic hard-constraint gate. Purely
 * presentational (server component). The label is localized; the hint is
 * exposed via `title` for a plain-language explanation.
 */
export function GateBadge({ gate }: { gate: EligibilityGate }) {
  const copy = t().opportunities;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[gate]}`}
      title={copy.gateHint[gate]}
    >
      {copy.gate[gate]}
    </span>
  );
}
