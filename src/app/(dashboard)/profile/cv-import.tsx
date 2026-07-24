"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";
import {
  addSkillsAction,
  analyzeCvAction,
  applyCvProfileAction,
  type CvAnalysis,
} from "@/lib/profile/cv-actions";
import type { CvProfileUnderstanding } from "@/lib/profile/cv-ai";
import {
  discoverOpportunitiesAction,
  type DiscoveryResult,
} from "@/lib/discovery/actions";
import { explainMatchesAction } from "@/lib/matching/insight-actions";

/** Auto-chained discovery state on the success screens (owner mandate:
 *  validate once, then just discover the results — no more buttons). */
type AutoDiscovery =
  { phase: "searching" } | { phase: "done"; result: DiscoveryResult };

type Step =
  | { name: "idle" }
  | { name: "detected"; skills: string[]; chosen: Set<string>; aiUsed: boolean }
  | { name: "understood"; profile: CvProfileUnderstanding; chosen: Set<string> }
  | { name: "added"; count: number; discovery: AutoDiscovery }
  | { name: "applied"; count: number; discovery: AutoDiscovery };

/**
 * "Import my CV" — upload a PDF (or paste the text) → deep AI understanding
 * (one review screen) or, as fallback, detected-skill chips. In both flows the
 * user's single validation confirms the claims AND auto-chains the offer
 * discovery. The CV itself is NEVER stored — analysis happens in-memory and
 * only the validated claims are saved.
 */
export function CvImport() {
  const router = useRouter();
  const copy = t().cvImport;
  const discoverCopy = t().opportunities.discover;
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  // Identity of the LATEST auto-discovery run: a stale completion from a
  // previous import cycle must never overwrite the current screen's result.
  const discoverRunRef = useRef(0);

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
    // Pre-check the size client-side: past the server-action body limit the
    // framework rejects the request before our code runs, so the user would
    // only ever see a generic error.
    if (file && file.size > 10 * 1024 * 1024) {
      setError(copy.errors.tooLarge);
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
      if (result.profile) {
        // Deep AI understanding → the single review screen.
        setStep({
          name: "understood",
          profile: result.profile,
          chosen: new Set(result.profile.coreSkills),
        });
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
        aiUsed: result.aiUsed,
      });
    } catch {
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  /**
   * The auto-chained discovery (owner mandate: after the one validation, the
   * offers just arrive). Runs OUTSIDE the busy window so the user can already
   * navigate; the functional update keeps a stale completion from clobbering
   * a screen the user has since left.
   */
  async function autoDiscover(target: "added" | "applied") {
    const run = ++discoverRunRef.current;
    let result: DiscoveryResult;
    try {
      result = await discoverOpportunitiesAction();
    } catch {
      result = { ok: false, error: "generic" };
    }
    if (run !== discoverRunRef.current) return; // a newer run owns the screen
    setStep((s) =>
      s.name === target ? { ...s, discovery: { phase: "done", result } } : s,
    );
    if (result.ok && result.imported > 0) {
      router.refresh();
      // Full fluidity: the freshly imported offers get their "pourquoi ce
      // match" analysis without another click. Server-side it is inert when
      // AI is unconfigured, cost-bounded and freshness-aware; here it stays
      // silent (the inbox shows the insights when ready) — same run-token
      // guard so an obsolete completion refreshes nothing.
      try {
        const explained = await explainMatchesAction();
        if (
          run === discoverRunRef.current &&
          explained.ok &&
          explained.analyzed > 0
        ) {
          router.refresh();
        }
      } catch {
        // Honest degradation: the offers are already there; the analysis can
        // be relaunched from the inbox.
      }
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
      setStep({
        name: "added",
        count: result.added,
        discovery: { phase: "searching" },
      });
      setPasted("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(copy.errors.generic);
      return;
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
    await autoDiscover("added");
  }

  function toggle(skill: string) {
    if (step.name !== "detected" && step.name !== "understood") return;
    const chosen = new Set(step.chosen);
    if (chosen.has(skill)) chosen.delete(skill);
    else chosen.add(skill);
    setStep({ ...step, chosen });
  }

  async function applyProfile() {
    if (inFlightRef.current || step.name !== "understood") return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const p = step.profile;
      const result = await applyCvProfileAction({
        roleTitle: p.roleTitle,
        seniorityLevel: p.seniorityLevel,
        yearsExperience: p.yearsExperience,
        summary: p.summary,
        skills: [...step.chosen],
        targetRoles: p.targetRoles,
      });
      if (!result.ok) {
        setError(copy.errors.generic);
        return;
      }
      setStep({
        name: "applied",
        count: result.confirmed,
        discovery: { phase: "searching" },
      });
      setPasted("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(copy.errors.generic);
      return;
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
    await autoDiscover("applied");
  }

  /** The discovery status line shared by the two success screens. */
  function discoveryLine(discovery: AutoDiscovery) {
    if (discovery.phase === "searching") {
      return (
        <p className="text-muted-foreground text-xs motion-safe:animate-pulse">
          {discoverCopy.searching}
        </p>
      );
    }
    const { result } = discovery;
    if (result.ok) {
      return (
        <p className="text-muted-foreground text-xs">
          {discoverCopy.result(
            result.imported,
            result.duplicates,
            result.failed,
          )}
          {result.failedSearches > 0
            ? ` ${discoverCopy.partial(result.failedSearches)}`
            : ""}
        </p>
      );
    }
    return (
      <p className="text-muted-foreground text-xs">
        {discoverCopy.errors[result.error]}
      </p>
    );
  }

  if (step.name === "applied") {
    return (
      <div
        role="status"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">{copy.applied(step.count)}</p>
        <p className="text-muted-foreground text-xs">{copy.appliedNote}</p>
        {discoveryLine(step.discovery)}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/opportunities">{copy.seeOffers}</Link>
          </Button>
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

  if (step.name === "understood") {
    const p = step.profile;
    return (
      <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{copy.understood.title}</p>
          <p className="text-muted-foreground text-xs">
            {copy.understood.note}
          </p>
        </div>
        {p.needsReview ? (
          <p
            role="note"
            className="border-warning/40 bg-warning/10 text-foreground/80 rounded-lg border px-3 py-2 text-xs"
          >
            {copy.understood.unsureNote}
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {copy.understood.roleLabel}
          </p>
          <p className="text-base font-semibold">
            {p.roleTitle}
            {p.seniorityLevel ? (
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                · {p.seniorityLevel}
              </span>
            ) : null}
            {p.yearsExperience !== null ? (
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                · {copy.understood.years(p.yearsExperience)}
              </span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs italic">
            {p.roleRationale}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {copy.understood.summaryLabel}
          </p>
          <p className="text-sm">{p.summary}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {copy.understood.skillsLabel}
          </p>
          <ul className="flex flex-wrap gap-2">
            {p.coreSkills.map((skill) => {
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
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {copy.understood.targetsLabel}
          </p>
          <p className="text-sm">{p.targetRoles.join(" · ")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={applyProfile} {...busyProps}>
            {copy.understood.apply}
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

  if (step.name === "added") {
    return (
      <div
        role="status"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">{copy.added(step.count)}</p>
        {discoveryLine(step.discovery)}
        <div className="flex flex-wrap gap-2">
          {step.discovery.phase === "done" && step.discovery.result.ok ? (
            <Button asChild size="sm">
              <Link href="/opportunities">{copy.seeOffers}</Link>
            </Button>
          ) : null}
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
        <p className="text-muted-foreground text-xs">
          {copy.detectedNote}
          {step.aiUsed ? ` ${copy.aiNote}` : ""}
        </p>
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
