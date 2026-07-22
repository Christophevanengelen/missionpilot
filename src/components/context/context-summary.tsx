import { StateBadge } from "@/components/context/state-badge";
import { t } from "@/lib/copy";
import type { KnownFact } from "@/lib/ux/conversation-types";

/**
 * "What MissionPilot understood" — the running known-facts set + non-intrusive
 * progress. Prop-driven (real features pass real facts; the preview passes
 * mock ones). Mirrors thread cards — never the only place info lives. Desktop
 * side panel; on mobile it is rendered inside a top sheet by the page.
 */
export function ContextSummary({
  facts,
  progress,
}: {
  facts: KnownFact[];
  progress: number;
}) {
  const copy = t();
  return (
    <section aria-label={copy.context.title} className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">
          {copy.context.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {copy.context.progress(progress)}
        </p>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={copy.context.progress(progress)}
          className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full motion-safe:transition-[width] motion-safe:duration-(--duration-base)"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {facts.map((f) => (
          <li
            key={f.label}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex flex-col">
              <span className="text-muted-foreground text-xs">{f.label}</span>
              <span>{f.value}</span>
            </span>
            <StateBadge state={f.state} />
          </li>
        ))}
      </ul>
    </section>
  );
}
