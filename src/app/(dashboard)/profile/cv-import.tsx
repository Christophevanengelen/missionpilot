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
  analyzeLinkedInAction,
  applyCvProfileAction,
  type CvAnalysis,
} from "@/lib/profile/cv-actions";
import type { CvProfileUnderstanding } from "@/lib/profile/cv-ai";
import type { AtsFinding } from "@/lib/profile/cv-ats-lint";

type Source = "cv" | "linkedin";

type Step =
  | { name: "idle" }
  | {
      name: "detected";
      skills: string[];
      chosen: Set<string>;
      aiUsed: boolean;
      source: Source;
      atsFindings: AtsFinding[];
    }
  | {
      name: "understood";
      profile: CvProfileUnderstanding;
      chosen: Set<string>;
      atsFindings: AtsFinding[];
    }
  | { name: "added"; count: number }
  | { name: "applied"; count: number };

/**
 * "Import my CV" — upload a PDF (or paste the text) → deep AI understanding
 * (one review screen) or, as fallback, detected-skill chips. In both flows the
 * user's single validation confirms the claims AND auto-chains the offer
 * discovery. The CV itself is NEVER stored — analysis happens in-memory and
 * only the validated claims are saved.
 */
/**
 * `only` narrows the component to ONE import path.
 *
 * The first screen used to offer four ways to begin — a PDF field, a paste
 * box, a LinkedIn archive field, and two buttons — which is three choices too
 * many for someone who has not yet been shown a single result. Onboarding asks
 * one thing; the profile screen, where people go deliberately, still offers
 * both.
 */
export function CvImport({
  only,
  linkedInPret = false,
}: { only?: Source; linkedInPret?: boolean } = {}) {
  const router = useRouter();
  const copy = t().cvImport;
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ATS findings to show alongside an error on the idle form (e.g. a scanned
  // image PDF that extracts no text — the note is the actionable message).
  const [idleAtsFindings, setIdleAtsFindings] = useState<AtsFinding[]>([]);
  /* Jamais pré-coché, et à dessein : un consentement pré-coché n'en est pas un
     (art. 4(11) — « acte positif clair »). L'état repart à faux à chaque
     montage, donc à chaque nouveau dépôt. */
  const [consentArt9, setConsentArt9] = useState(false);
  const consentRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkedinRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  /** Route an analysis result (CV or LinkedIn — identical shape) to the right
   *  screen. `source` only tailors the detected-screen heading wording.
   *  Returns false when it surfaced an error instead. */
  function routeAnalysis(result: CvAnalysis, source: Source): boolean {
    if (!result.ok) {
      setError(copy.errors[result.error]);
      return false;
    }
    if (result.profile) {
      // Deep AI understanding → the single review screen.
      setStep({
        name: "understood",
        profile: result.profile,
        chosen: new Set(result.profile.coreSkills),
        atsFindings: result.atsFindings,
      });
      return true;
    }
    if (result.skills.length === 0) {
      setError(copy.noneDetected);
      return false;
    }
    setStep({
      name: "detected",
      skills: result.skills,
      chosen: new Set(result.skills),
      aiUsed: result.aiUsed,
      source,
      atsFindings: result.atsFindings,
    });
    return true;
  }

  /** ATS parse-safety note shown on the review screens after a PDF upload
   *  (empty for pasted text / LinkedIn). Advisory: it's about the FILE. */
  function atsNote(findings: AtsFinding[]) {
    if (findings.length === 0) return null;
    const c = copy.ats;
    const isError = findings.some((f) => f.severity === "error");
    return (
      <div
        role="note"
        className={`rounded-lg border px-3 py-2 text-xs ${
          isError
            ? "border-destructive/40 bg-destructive/10"
            : "border-warning/40 bg-warning/10"
        }`}
      >
        <p className="font-medium">{c.title}</p>
        <ul className="mt-1 list-disc pl-4">
          {findings.map((f) => (
            <li key={f.code}>{c.findings[f.code]}</li>
          ))}
        </ul>
      </div>
    );
  }

  async function analyze() {
    if (inFlightRef.current) return;
    setIdleAtsFindings([]);
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
    // Refus AVANT l'envoi : inutile de faire voyager un CV pour le renvoyer.
    // Le focus va sur la case, pas sur le message — c'est là qu'il faut agir.
    if (!consentArt9) {
      setError(copy.errors.consent);
      consentRef.current?.focus();
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    setIdleAtsFindings([]);
    try {
      const formData = new FormData();
      if (file) formData.set("file", file);
      if (pasted.trim()) formData.set("text", pasted);
      // Le consentement voyage avec le dépôt. Le serveur le revérifie : ici ce
      // n'est qu'un transport, pas un contrôle.
      if (consentArt9) formData.set("consentArt9", "on");
      const result = await analyzeCvAction(formData);
      // On an error/no-skills path the idle form stays visible — surface the
      // ATS note there (a scanned image PDF's key guidance). `atsFindings` is
      // present on both branches (required on ok, optional on error).
      if (!routeAnalysis(result, "cv") && result.atsFindings?.length) {
        setIdleAtsFindings(result.atsFindings);
      }
    } catch {
      setError(copy.errors.generic);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  async function analyzeLinkedIn() {
    if (inFlightRef.current) return;
    setIdleAtsFindings([]);
    const file = linkedinRef.current?.files?.[0] ?? null;
    if (!file) {
      setError(copy.linkedin.needFile);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(copy.errors.tooLarge);
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      routeAnalysis(await analyzeLinkedInAction(formData), "linkedin");
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
      setStep({
        name: "added",
        count: result.added,
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
  }

  /** The discovery status line shared by the two success screens. */
  if (step.name === "applied") {
    return (
      <div
        role="status"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">{copy.applied(step.count)}</p>
        <p className="text-muted-foreground text-xs">{copy.appliedNote}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">{copy.seeOffers}</Link>
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
        {atsNote(step.atsFindings)}

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
        <div className="flex flex-wrap gap-2">
          {/* Unconditional, like the "applied" screen above: this run failing
              says nothing about the inbox, which may already hold offers from
              earlier runs. Hiding the way there was a second punishment for a
              failure the user did not cause. */}
          <Button asChild size="sm">
            <Link href="/dashboard">{copy.seeOffers}</Link>
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

  if (step.name === "detected") {
    return (
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">
          {step.source === "linkedin"
            ? copy.linkedin.detectedTitle
            : copy.detectedTitle}
        </p>
        <p className="text-muted-foreground text-xs">
          {copy.detectedNote}
          {step.aiUsed ? ` ${copy.aiNote}` : ""}
        </p>
        {atsNote(step.atsFindings)}
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
    <div className="flex flex-col gap-3">
      {only === "linkedin" ? null : (
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
          {/* Le consentement de l'art. 9, juste avant le bouton : c'est le
              moment de la décision, pas une case perdue en bas de page. */}
          <div className="border-border flex flex-col gap-2 border-t pt-3">
            <div className="flex items-start gap-2">
              <input
                id="cv-consent-art9"
                ref={consentRef}
                type="checkbox"
                checked={consentArt9}
                onChange={(e) => setConsentArt9(e.target.checked)}
                disabled={busy}
                className="border-input mt-1 size-4 shrink-0 rounded"
              />
              <Label htmlFor="cv-consent-art9" className="text-sm font-normal">
                {copy.art9.label}
              </Label>
            </div>
            <p className="text-muted-foreground pl-6 text-xs text-pretty">
              {copy.art9.detail}
            </p>
            <p className="text-muted-foreground pl-6 text-xs text-pretty">
              {copy.art9.mesure}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" {...busyProps}>
              {copy.analyze}
            </Button>
          </div>
        </form>
      )}

      {only === "cv" ? null : (
        <form
          className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void analyzeLinkedIn();
          }}
        >
          <p className="text-sm font-medium">{copy.linkedin.title}</p>
          <p className="text-muted-foreground text-xs">{copy.linkedin.note}</p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="linkedin-file">{copy.linkedin.fileLabel}</Label>
            <input
              id="linkedin-file"
              ref={linkedinRef}
              type="file"
              accept="application/zip,.zip"
              disabled={busy}
              className="border-input bg-background file:bg-muted file:text-foreground w-full min-w-0 rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" variant="outline" {...busyProps}>
              {copy.linkedin.analyze}
            </Button>
          </div>
        </form>
      )}

      {only === "cv" || !linkedInPret ? null : (
        <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
          <p className="text-sm font-medium">{copy.linkedinApi.title}</p>
          <p className="text-muted-foreground text-xs">
            {copy.linkedinApi.note}
          </p>
          {/* Un LIEN, pas un bouton : le flux OAuth est une navigation vers
              LinkedIn, et la faire passer par du JavaScript casserait
              l'ouverture dans un nouvel onglet, le clic-droit, et le retour
              arrière. */}
          <a
            href="/api/linkedin/start"
            className="bg-primary text-primary-foreground self-start rounded-md px-4 py-2 text-sm font-medium motion-safe:transition-opacity hover:opacity-90"
          >
            {copy.linkedinApi.analyze}
          </a>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {atsNote(idleAtsFindings)}
    </div>
  );
}
