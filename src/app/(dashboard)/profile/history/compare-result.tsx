import { t } from "@/lib/copy";
import { claimValueLabel } from "@/lib/profile/interview";
import type { ClaimKind } from "@/domain/profile";
import type { SnapshotClaim } from "@/lib/profile/version-content";
import type { DiffEntry, VersionDiff } from "@/lib/profile/version-diff";

/**
 * Business-level rendering of a version comparison — never a technical
 * diff. Sections Ajouté / Modifié / Supprimé; unchanged entries collapsed
 * by default. The header counts derive from the SAME diff entries.
 */

function label(claim: SnapshotClaim): string {
  return claimValueLabel({ kind: claim.kind as ClaimKind, value: claim.value });
}

function kindLabel(kind: string): string {
  return t().interview.kindLabels[kind as ClaimKind] ?? kind;
}

function EntryLine({ claim }: { claim: SnapshotClaim }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{kindLabel(claim.kind)}</span>
      {" — "}
      <span className="font-medium whitespace-pre-line">{label(claim)}</span>
    </p>
  );
}

function ModifiedEntry({ entry }: { entry: DiffEntry }) {
  const copy = t().history.compare;
  if (!entry.before || !entry.after) return null;
  const valueChanged = label(entry.before) !== label(entry.after);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{kindLabel(entry.kind)}</p>
      {valueChanged ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="border-border bg-surface-raised rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{copy.before}</p>
            <p className="text-sm whitespace-pre-line">{label(entry.before)}</p>
          </div>
          <div className="border-border bg-card rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{copy.after}</p>
            <p className="text-sm whitespace-pre-line">{label(entry.after)}</p>
          </div>
        </div>
      ) : null}
      {entry.evidenceChanges ? (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          {entry.evidenceChanges.added.map((e) => (
            <li key={`a-${e.evidence_id}`}>
              {copy.evidenceAdded} — {e.title}
            </li>
          ))}
          {entry.evidenceChanges.removed.map((e) => (
            <li key={`r-${e.evidence_id}`}>
              {copy.evidenceRemoved} — {e.title}
            </li>
          ))}
          {entry.evidenceChanges.changed.map((c) => (
            <li key={`c-${c.after.evidence_id}`}>
              {copy.evidenceChanged} — {c.after.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({
  title,
  entries,
  render,
}: {
  title: string;
  entries: DiffEntry[];
  render: (entry: DiffEntry, index: number) => React.ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{entries.map(render)}</div>
    </section>
  );
}

export function CompareResult({
  from,
  to,
  diff,
}: {
  from: number;
  to: number;
  diff: VersionDiff;
}) {
  const copy = t().history.compare;
  const added = diff.entries.filter((e) => e.status === "added");
  const modified = diff.entries.filter((e) => e.status === "modified");
  const removed = diff.entries.filter((e) => e.status === "removed");
  const unchanged = diff.entries.filter((e) => e.status === "unchanged");
  const total = diff.counts.added + diff.counts.modified + diff.counts.removed;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label={copy.title}
        className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4"
      >
        <h2 className="text-sm font-semibold">{copy.direction(from, to)}</h2>
        <p className="text-lg font-semibold">{copy.changesCount(total)}</p>
        {total > 0 ? (
          <p className="text-muted-foreground text-sm">
            {copy.countsDetail(
              diff.counts.added,
              diff.counts.modified,
              diff.counts.removed,
            )}
          </p>
        ) : null}
      </section>

      <Section
        title={copy.added}
        entries={added}
        render={(e, i) =>
          e.after ? <EntryLine key={i} claim={e.after} /> : null
        }
      />
      <Section
        title={copy.modified}
        entries={modified}
        render={(e, i) => <ModifiedEntry key={i} entry={e} />}
      />
      <Section
        title={copy.removed}
        entries={removed}
        render={(e, i) =>
          e.before ? <EntryLine key={i} claim={e.before} /> : null
        }
      />

      {unchanged.length > 0 ? (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer text-xs font-medium tracking-wide uppercase">
            {copy.unchanged} ({unchanged.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1 opacity-80">
            {unchanged.map((e, i) =>
              e.after ? <EntryLine key={i} claim={e.after} /> : null,
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}
