"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Local selection of the two compared versions. Purely navigational — the
 * comparison itself is server-rendered from the database. Native controls
 * are appropriate here (no mutation involved).
 */
export function ComparePicker({
  numbers,
  from,
  to,
}: {
  numbers: number[];
  from: number;
  to: number;
}) {
  const router = useRouter();
  const copy = t().history;

  const push = (f: number, to_: number) => {
    router.push(`/profile/history?from=${f}&to=${to_}`);
  };

  const selectClass =
    "border-input bg-background h-9 rounded-md border px-2 text-sm";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="compare-from" className="text-xs">
          {copy.compare.reference}
        </Label>
        <select
          id="compare-from"
          className={selectClass}
          value={from}
          onChange={(e) => push(Number(e.target.value), to)}
        >
          {numbers.map((n) => (
            <option key={n} value={n}>
              {copy.versionLabel(n)}
            </option>
          ))}
        </select>
      </div>
      <span aria-hidden="true" className="text-muted-foreground pb-2">
        →
      </span>
      <div className="flex flex-col gap-1">
        <Label htmlFor="compare-to" className="text-xs">
          {copy.compare.compared}
        </Label>
        <select
          id="compare-to"
          className={selectClass}
          value={to}
          onChange={(e) => push(from, Number(e.target.value))}
        >
          {numbers.map((n) => (
            <option key={n} value={n}>
              {copy.versionLabel(n)}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={from === to}
        onClick={() => push(to, from)}
      >
        {copy.compare.invert}
      </Button>
    </div>
  );
}
