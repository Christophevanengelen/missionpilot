"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";
import {
  addSkillsAction,
  analyzeCvAction,
  type CvAnalysis,
} from "@/lib/profile/cv-actions";

type Step =
  | { name: "idle" }
  | { name: "detected"; skills: string[]; chosen: Set<string> }
  | { name: "added"; count: number };

/**
 * "Import my CV" — upload a PDF (or paste the text) → deterministic skill
 * detection → the user picks which skills to add to their profile (they enter
 * the normal claim lifecycle as proposals). The CV itself is NEVER stored —
 * analysis happens in-memory and only the chosen skills are saved.
 */
export function CvImport() {
  const router = useRouter();
  const copy = t().cvImport;
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  async function analyze() {
    if (inFlightRef.current) return;
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file && !pasted.trim()) {
      setError(copy.needInput);
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      if (file) formData.set("file", file);
      if (pasted.trim()) formData.set("text", pasted);
      const result: CvAnalysis = await analyzeCvAction(formData);
      if (!result.ok) {
        setError(copy.errors[result.error]);
        return;
      }
      if (result.skills.length === 0) {
        setError(copy.noneDetected);
        return;
      }
      setStep({
        name: "detected",
        skills: result.skills,
        chosen: new Set(result.skills),
      });
    } catch {
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  async function addChosen() {
    if (inFlightRef.current || step.name !== "detected") return;
    const skills = [...step.chosen];
    if (skills.length === 0) {
      setError(copy.chooseOne);
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await addSkillsAction({ skills });
      if (!result.ok) {
        setError(copy.errors.generic);
        return;
      }
      setStep({ name: "added", count: result.added });
      setPasted("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function toggle(skill: string) {
    if (step.name !== "detected") return;
    const chosen = new Set(step.chosen);
    if (chosen.has(skill)) chosen.delete(skill);
    else chosen.add(skill);
    setStep({ ...step, chosen });
  }

  if (step.name === "added") {
    return (
      <div
        role="status"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">{copy.added(step.count)}</p>
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStep({ name: "idle" })}
          >
            {copy.again}
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === "detected") {
    return (
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">{copy.detectedTitle}</p>
        <p className="text-muted-foreground text-xs">{copy.detectedNote}</p>
        <ul className="flex flex-wrap gap-2">
          {step.skills.map((skill) => {
            const on = step.chosen.has(skill);
            return (
              <li key={skill}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(skill)}
                  disabled={busy}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {skill}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={addChosen} {...busyProps}>
            {copy.addChosen}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setStep({ name: "idle" })}
          >
            {copy.back}
          </Button>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void analyze();
      }}
    >
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="text-muted-foreground text-xs">{copy.note}</p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cv-file">{copy.fileLabel}</Label>
        <input
          id="cv-file"
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          className="border-input bg-background file:bg-muted file:text-foreground w-full min-w-0 rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cv-text">{copy.pasteLabel}</Label>
        <textarea
          id="cv-text"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          disabled={busy}
          maxLength={100000}
          rows={4}
          placeholder={copy.pastePlaceholder}
          className="border-input bg-background w-full min-w-0 rounded-lg border p-3 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" {...busyProps}>
          {copy.analyze}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
