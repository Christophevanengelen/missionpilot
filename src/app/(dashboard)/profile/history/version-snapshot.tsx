import { t } from "@/lib/copy";
import { CardField } from "@/components/cards/card-shell";
import { claimValueLabel, FOUNDATION_ORDER } from "@/lib/profile/interview";
import type { ClaimKind } from "@/domain/profile";
import { SINGLE_VALUED_KINDS } from "@/domain/profile";
import type {
  SnapshotClaim,
  VersionContent,
} from "@/lib/profile/version-content";

/**
 * Faithful READ-ONLY rendering of a version snapshot, with the same
 * business labels as the current profile. No form, no editable control —
 * an old version must never look editable.
 */

function kindRank(kind: string): number {
  const i = (FOUNDATION_ORDER as readonly string[]).indexOf(kind);
  return i === -1 ? FOUNDATION_ORDER.length : i;
}

function label(claim: SnapshotClaim): string {
  return claimValueLabel({
    kind: claim.kind as ClaimKind,
    value: claim.value,
  });
}

export function VersionSnapshot({ content }: { content: VersionContent }) {
  const copy = t().interview;
  const claims = [...content.claims].sort(
    (a, b) => kindRank(a.kind) - kindRank(b.kind),
  );
  const singles = claims.filter((c) =>
    (SINGLE_VALUED_KINDS as readonly string[]).includes(c.kind),
  );
  const collections = claims.filter(
    (c) => !(SINGLE_VALUED_KINDS as readonly string[]).includes(c.kind),
  );

  if (claims.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t().history.emptyVersion}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {singles.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {singles.map((c) => (
            <CardField
              key={c.kind}
              label={copy.kindLabels[c.kind as ClaimKind]}
              wide={c.kind === "summary"}
            >
              <span className="whitespace-pre-line">{label(c)}</span>
            </CardField>
          ))}
        </dl>
      ) : null}
      {collections.map((c, i) => (
        <div key={`${c.kind}-${i}`} className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {copy.kindLabels[c.kind as ClaimKind]}
          </p>
          <p className="text-sm font-medium whitespace-pre-line">{label(c)}</p>
          {c.evidence.length > 0 ? (
            <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              {c.evidence.map((e) => (
                <li key={e.evidence_id}>
                  {e.title}
                  {e.verification_status === "user_confirmed"
                    ? ` — ${copy.declaredBy}`
                    : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
