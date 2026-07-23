import { cn } from "@/lib/utils";
import { StateBadge } from "@/components/context/state-badge";
import type { CardState } from "@/lib/ux/card-state";
import type { Locale } from "@/lib/copy";

/**
 * Visual registers (DESIGN_SYSTEM.md): hierarchy comes from typography,
 * space and composition — not decoration. `hero` carries only a very
 * discreet elevation (shadow-raised); nothing else casts a shadow.
 */
export type CardVariant =
  | "quiet" // workhorse proposals (understanding)
  | "document" // evidence pieces — accent rail, raised surface
  | "hero" // the recommendation — larger type & padding
  | "ceremonial" // external-action approval — solemn, neutral
  | "instrument" // dense/technical (score breakdown)
  | "recessed"; // rejected — compact, dashed, set aside

const VARIANT_STYLE: Record<CardVariant, string> = {
  quiet: "border-border bg-card p-4",
  document: "border-border bg-surface-raised border-l-2 p-4",
  hero: "border-border/80 bg-card p-6 shadow-raised",
  ceremonial: "border-border bg-card p-6",
  instrument: "border-border bg-surface-raised p-4",
  recessed: "border-border border-dashed bg-transparent px-4 py-3",
};

/**
 * Shared frame for every in-thread proposal card: title, state badge, body,
 * and an actions row. Presentational and prop-driven — reusable by real
 * features and by the mock UX Preview alike.
 */
export function CardShell({
  title,
  state,
  locale,
  variant = "quiet",
  children,
  actions,
  className,
}: {
  title: string;
  state: CardState;
  locale?: Locale;
  variant?: CardVariant;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const hero = variant === "hero" || variant === "ceremonial";
  return (
    <section
      aria-label={title}
      data-state={state}
      data-variant={variant}
      className={cn(
        "rounded-xl border motion-safe:transition-colors motion-safe:duration-(--duration-base)",
        VARIANT_STYLE[variant],
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3",
          variant === "recessed" ? "mb-1" : hero ? "mb-4" : "mb-3",
        )}
      >
        <h3
          className={cn(
            "font-semibold tracking-tight",
            hero ? "text-base" : "text-sm",
            variant === "recessed" && "text-muted-foreground font-medium",
          )}
        >
          {title}
        </h3>
        <StateBadge state={state} locale={locale} />
      </header>
      <div className="text-sm">{children}</div>
      {actions ? (
        <div className={cn("flex flex-wrap gap-2", hero ? "mt-5" : "mt-4")}>
          {actions}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Label-over-value pair for a card. Used inside a `<dl>` grid
 * (`grid gap-x-6 gap-y-3 sm:grid-cols-2`) — no rule lines, the rhythm
 * comes from spacing. `chips` renders a list of small pills instead of a
 * plain value; `wide` spans the full grid width.
 */
export function CardField({
  label,
  children,
  warn,
  chips,
  wide,
}: {
  label: string;
  children?: React.ReactNode;
  warn?: string;
  chips?: string[];
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", wide && "sm:col-span-2")}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm leading-snug font-medium">
        {chips ? (
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="border-border bg-background text-foreground rounded-full border px-2 py-0.5 text-xs font-normal"
              >
                {chip}
              </span>
            ))}
          </span>
        ) : (
          children
        )}
        {warn ? (
          <span className="text-muted-foreground ml-2 text-xs font-medium">
            <span aria-hidden="true" className="text-warning">
              ⚠
            </span>{" "}
            {warn}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
