import { CardShell, CardField } from "@/components/cards/card-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import type { OpportunityCard as OpportunityCardData } from "@/lib/ux/conversation-types";

export function OpportunityCard({ data }: { data: OpportunityCardData }) {
  const c = t().actions;
  return (
    <CardShell title={data.title} state={data.state}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {data.role} · {data.company}
          </span>
          <Badge
            variant="outline"
            className="border-success/50 bg-success/8 text-foreground"
          >
            {t().verdicts[data.verdict]}
          </Badge>
        </div>
        <dl>
          <CardField label="Score / Confiance">
            <span className="font-mono tabular-nums">{data.score}</span>
            <span className="text-muted-foreground"> / 100 · </span>
            <span className="font-mono tabular-nums">{data.confidence}</span>
            <span className="text-muted-foreground"> %</span>
          </CardField>
          <CardField label="Remote">{data.remote}</CardField>
          <CardField label="TJM">{data.rate}</CardField>
          <CardField label="Atout">{data.strength}</CardField>
          <CardField label="Risque">{data.risk}</CardField>
        </dl>
      </div>
      <CardActions labels={[c.viewScore, c.compare, c.save, c.ignore]} />
    </CardShell>
  );
}

function CardActions({ labels }: { labels: string[] }) {
  return (
    <>
      {labels.map((label, i) => (
        <Button
          key={label}
          type="button"
          variant={i === 0 ? "default" : "outline"}
          size="sm"
        >
          {label}
        </Button>
      ))}
    </>
  );
}
