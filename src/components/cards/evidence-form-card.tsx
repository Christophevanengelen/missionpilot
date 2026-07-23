"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CardShell } from "@/components/cards/card-shell";
import { t } from "@/lib/copy";

export type EvidenceFormValues = {
  title: string;
  organization: string;
  statement: string;
  metric: string;
  periodStart: string;
  periodEnd: string;
  rolePlayed: string;
  skills: string;
  sourceReference: string;
};

const EMPTY: EvidenceFormValues = {
  title: "",
  organization: "",
  statement: "",
  metric: "",
  periodStart: "",
  periodEnd: "",
  rolePlayed: "",
  skills: "",
  sourceReference: "",
};

/**
 * Manual proof creation — document register, in-thread. Provenance is always
 * honest: what the user types here is « déclarée par vous », never more.
 */
export function EvidenceFormCard({
  attachToTitle,
  busy,
  onSubmit,
  onCancel,
}: {
  /** Title of the achievement this proof will back (shown on the submit). */
  attachToTitle?: string;
  busy?: boolean;
  onSubmit: (values: EvidenceFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const copy = t().interview.evidenceForm;
  const [values, setValues] = useState<EvidenceFormValues>(EMPTY);
  const set =
    (key: keyof EvidenceFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: event.target.value }));

  const field = (
    key: keyof EvidenceFormValues,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={`evidence-${key}`}
        className="text-muted-foreground text-xs"
      >
        {label}
      </Label>
      <Input
        id={`evidence-${key}`}
        className="min-w-0 w-full"
        value={values[key]}
        onChange={set(key)}
        disabled={busy}
        {...props}
      />
    </div>
  );

  return (
    <CardShell
      title={copy.title}
      state="proposed"
      variant="document"
      className="border-l-primary/30 w-full max-w-[44rem]"
    >
      <form
        className="grid gap-x-6 gap-y-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void onSubmit(values);
        }}
      >
        <div className="sm:col-span-2">
          {field("title", copy.fields.title, {
            required: true,
            maxLength: 300,
          })}
        </div>
        {field("organization", copy.fields.organization, { maxLength: 200 })}
        {field("rolePlayed", copy.fields.rolePlayed, { maxLength: 200 })}
        <div className="sm:col-span-2 flex flex-col gap-1">
          <Label
            htmlFor="evidence-statement"
            className="text-muted-foreground text-xs"
          >
            {copy.fields.statement}
          </Label>
          <textarea
            id="evidence-statement"
            value={values.statement}
            onChange={set("statement")}
            disabled={busy}
            required
            maxLength={5000}
            rows={3}
            className="border-input bg-transparent focus-visible:ring-ring/50 rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
          />
        </div>
        {field("metric", copy.fields.metric, { maxLength: 200 })}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {copy.fields.period}
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              aria-label={`${copy.fields.period} — début`}
              className="min-w-0 w-full"
              type="date"
              value={values.periodStart}
              onChange={set("periodStart")}
              disabled={busy}
            />
            <Input
              aria-label={`${copy.fields.period} — fin`}
              className="min-w-0 w-full"
              type="date"
              value={values.periodEnd}
              onChange={set("periodEnd")}
              disabled={busy}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          {field("skills", copy.fields.skills, { maxLength: 400 })}
        </div>
        <div className="sm:col-span-2">
          {field("sourceReference", copy.fields.sourceReference, {
            maxLength: 1000,
          })}
        </div>
        <p className="text-muted-foreground sm:col-span-2 text-xs">
          {t().interview.declaredBy} — {t().approval.reassure}
        </p>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={busy}
            className="h-auto max-w-full text-left whitespace-normal"
          >
            {attachToTitle ? copy.attach(attachToTitle) : copy.submit}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onCancel}
            >
              {copy.cancel}
            </Button>
          ) : null}
        </div>
      </form>
    </CardShell>
  );
}
