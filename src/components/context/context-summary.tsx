import { StateBadge } from "@/components/context/state-badge";
import { t } from "@/lib/copy";
import type { KnownFact } from "@/lib/ux/conversation-types";

/**
 * "What MissionPilot understood" — the running known-facts set + non-intrusive
 * progress. Prop-driven (real features pass real facts; the preview passes
 * mock ones). Deliberately secondary: caption-level heading, quiet type — it
 * reads as a margin note beside the conversation, never as a second product.
 * Mirrors thread cards — never the only place info lives.
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
    <section aria-label={copy.context.title} className="flex flex-col gap-5">
      <div>
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.context.title}
        </h2>
        <p className="text-muted-foreground mt-2 text-xs">
          {copy.context.progress(progress)}
        </p>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={copy.context.progress(progress)}
          className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full motion-safe:transition-[width] motion-safe:duration-(--duration-base)"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {facts.map((f) => (
          <li
            key={f.label}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-muted-foreground text-xs">{f.label}</span>
              <span className="truncate">{f.value}</span>
            </span>
            <StateBadge
              state={f.state}
              className="shrink-0 px-1.5 text-[11px]"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
