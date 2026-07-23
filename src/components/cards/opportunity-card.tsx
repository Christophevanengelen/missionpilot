import { CardShell, CardField } from "@/components/cards/card-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import type { OpportunityCard as OpportunityCardData } from "@/lib/ux/conversation-types";

/**
 * The recommendation — hero register. Hierarchy comes from typography and
 * composition: role reads first, the score is a quiet large numeral, and
 * exactly one action is primary.
 */
export function OpportunityCard({ data }: { data: OpportunityCardData }) {
  const a = t().actions;
  return (
    <CardShell title={data.title} state={data.state} variant="hero">
      <div className="flex flex-col gap-5">
        {/* Mobile: the score sits on its own line so the title keeps its
            natural width; from `sm` up it becomes the right-hand block. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xl leading-snug font-semibold tracking-tight">
              {data.role}
              <span className="text-muted-foreground font-normal">
                {" "}
                · {data.company}
              </span>
            </p>
            <Badge
              variant="outline"
              className="border-success/50 bg-success/8 text-foreground w-fit"
            >
              {t().verdicts[data.verdict]}
            </Badge>
          </div>
          <div className="flex shrink-0 items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
            <p aria-label={`Score ${data.score} sur 100`}>
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {data.score}
              </span>
              <span className="text-muted-foreground text-sm"> / 100</span>
            </p>
            <p className="text-muted-foreground text-xs">
              Confiance{" "}
              <span className="font-mono tabular-nums">{data.confidence}</span>{" "}
              %
            </p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <CardField label="Remote">{data.remote}</CardField>
          <CardField label="TJM">{data.rate}</CardField>
          <CardField label="Atout" wide>
            {data.strength}
          </CardField>
          <CardField label="Risque" wide>
            {data.risk}
          </CardField>
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" size="sm">
          {a.viewScore}
        </Button>
        <Button type="button" variant="ghost" size="sm">
          {a.compare}
        </Button>
        <Button type="button" variant="ghost" size="sm">
          {a.save}
        </Button>
        <Button type="button" variant="ghost" size="sm">
          {a.ignore}
        </Button>
      </div>
    </CardShell>
  );
}
