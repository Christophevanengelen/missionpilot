import { cn } from "@/lib/utils";
import { StateBadge } from "@/components/context/state-badge";
import type { CardState } from "@/lib/ux/card-state";
import type { Locale } from "@/lib/copy";

/**
 * Shared frame for every in-thread proposal card: title, state badge, body,
 * and an actions row. Presentational and prop-driven — reusable by real
 * features and by the mock UX Preview alike.
 */
export function CardShell({
  title,
  state,
  locale,
  children,
  actions,
  className,
}: {
  title: string;
  state: CardState;
  locale?: Locale;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      data-state={state}
      className={cn(
        "border-border bg-card text-card-foreground rounded-xl border p-4 motion-safe:transition-colors motion-safe:duration-(--duration-base)",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <StateBadge state={state} locale={locale} />
      </header>
      <div className="text-sm">{children}</div>
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </section>
  );
}

/** Label-value row, programmatically associated for screen readers. */
export function CardField({
  label,
  children,
  warn,
}: {
  label: string;
  children: React.ReactNode;
  warn?: string;
}) {
  return (
    <div className="border-border/50 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-right text-sm">
        {children}
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
