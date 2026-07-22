import { cn } from "@/lib/utils";
import { t } from "@/lib/copy";

export type ScoreComponent = {
  label: string;
  value: number; // 0-100
  evidence: string;
  low?: boolean;
};

/**
 * Explainable score, component by component (Flow 6 / PRD §6). Each row is a
 * labelled meter with a visible numeric value and its evidence; score and
 * confidence are separate labelled values; no meaning by bar color alone.
 */
export function ScoreBreakdown({
  weighted,
  confidence,
  hardConstraint,
  components,
}: {
  weighted: number;
  confidence: number;
  hardConstraint: "pass" | "warn" | "fail";
  components: ScoreComponent[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p>
          <span className="text-muted-foreground text-xs">Score pondéré</span>{" "}
          <span className="font-mono text-lg font-semibold tabular-nums">
            {weighted}
          </span>
          <span className="text-muted-foreground text-xs"> / 100</span>
        </p>
        <p>
          <span className="text-muted-foreground text-xs">Confiance</span>{" "}
          <span className="font-mono text-lg font-semibold tabular-nums">
            {confidence}
          </span>
          <span className="text-muted-foreground text-xs"> %</span>
        </p>
        <p className="text-xs">
          <span className="text-muted-foreground">Contraintes dures</span>{" "}
          <span className="text-foreground font-medium">
            <span
              aria-hidden="true"
              className={cn(
                hardConstraint === "pass" && "text-success",
                hardConstraint === "warn" && "text-warning",
                hardConstraint === "fail" && "text-destructive",
              )}
            >
              {hardConstraint === "pass"
                ? "✓"
                : hardConstraint === "warn"
                  ? "⚠"
                  : "✕"}
            </span>{" "}
            {t().hardConstraint[hardConstraint]}
          </span>
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {components.map((c) => (
          <li key={c.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium">
                {c.label}{" "}
                <span className="text-muted-foreground font-mono tabular-nums">
                  {c.value}
                </span>
              </span>
              <span className="text-muted-foreground">
                {c.evidence}
                {c.low ? (
                  <span
                    aria-hidden="true"
                    className="text-warning ml-1 font-medium"
                  >
                    ⚠
                  </span>
                ) : null}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${c.label} : ${c.value} sur 100`}
              aria-valuenow={c.value}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-muted h-1.5 overflow-hidden rounded-full"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  c.low ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${c.value}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
