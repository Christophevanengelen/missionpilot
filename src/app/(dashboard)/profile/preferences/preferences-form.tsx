"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/copy";
import {
  BASE_CURRENCIES,
  ENGAGEMENT_TYPES,
  profilePreferencesSchema,
  REMOTE_POLICIES,
  TRAVEL_TOLERANCES,
  type EngagementType,
  type ProfilePreferences,
} from "@/domain/profile";
import { savePreferencesAction } from "@/lib/profile/actions";

const listToText = (list: string[]) => list.join(", ");
const textToList = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

/** Empty string ⇒ null; otherwise a bounded integer (validation is the
 *  action's Zod job — here we only shape the payload). */
const textToRate = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isNaN(n) ? null : n;
};

type Outcome = "saved" | "error" | null;

export function PreferencesForm({ initial }: { initial: ProfilePreferences }) {
  const copy = t().preferences;
  const [prefs, setPrefs] = useState(initial);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  function set<K extends keyof ProfilePreferences>(
    key: K,
    value: ProfilePreferences[K],
  ) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function toggleEngagement(type: EngagementType) {
    setPrefs((p) => ({
      ...p,
      preferredEngagementTypes: p.preferredEngagementTypes.includes(type)
        ? p.preferredEngagementTypes.filter((x) => x !== type)
        : [...p.preferredEngagementTypes, type],
    }));
  }

  async function save() {
    if (inFlightRef.current) return;
    // Client-side pre-validation for an honest inline message; the action
    // re-validates authoritatively (defense in depth, sanitized errors).
    const parsed = profilePreferencesSchema.safeParse(prefs);
    if (!parsed.success) {
      setOutcome("error");
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setOutcome(null);
    try {
      const result = await savePreferencesAction(parsed.data);
      setOutcome(result.ok ? "saved" : "error");
    } catch {
      setOutcome("error");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  const selectClass =
    "border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section
          aria-label={copy.sections.targeting}
          className="flex flex-col gap-4"
        >
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.sections.targeting}
          </h2>
          <ListField
            id="roles"
            label={copy.fields.targetRoleFamilies}
            hint={copy.hints.list}
            value={listToText(prefs.targetRoleFamilies)}
            onChange={(text) => set("targetRoleFamilies", textToList(text))}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {copy.fields.preferredEngagementTypes}
            </legend>
            <div className="flex flex-wrap gap-2">
              {ENGAGEMENT_TYPES.map((type) => {
                const active = prefs.preferredEngagementTypes.includes(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => toggleEngagement(type)}
                  >
                    {copy.engagementTypes[type]}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <ListField
            id="languages"
            label={copy.fields.languages}
            hint={copy.hints.list}
            value={listToText(prefs.languages)}
            onChange={(text) => set("languages", textToList(text))}
          />
        </section>

        <section
          aria-label={copy.sections.conditions}
          className="flex flex-col gap-4"
        >
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.sections.conditions}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="target-rate">{copy.fields.targetDayRate}</Label>
              <Input
                id="target-rate"
                type="number"
                inputMode="numeric"
                min={0}
                max={20000}
                value={prefs.targetDayRate ?? ""}
                onChange={(e) =>
                  set("targetDayRate", textToRate(e.target.value))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="min-rate">{copy.fields.minimumDayRate}</Label>
              <Input
                id="min-rate"
                type="number"
                inputMode="numeric"
                min={0}
                max={20000}
                value={prefs.minimumDayRate ?? ""}
                onChange={(e) =>
                  set("minimumDayRate", textToRate(e.target.value))
                }
              />
              <p className="text-muted-foreground text-xs">
                {copy.hints.rateFloor}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="currency">{copy.fields.baseCurrency}</Label>
              <select
                id="currency"
                className={selectClass}
                value={prefs.baseCurrency ?? ""}
                onChange={(e) =>
                  set(
                    "baseCurrency",
                    (e.target.value ||
                      null) as ProfilePreferences["baseCurrency"],
                  )
                }
              >
                <option value="">{copy.none}</option>
                {BASE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="remote">{copy.fields.remotePolicy}</Label>
              <select
                id="remote"
                className={selectClass}
                value={prefs.remotePolicy ?? ""}
                onChange={(e) =>
                  set(
                    "remotePolicy",
                    (e.target.value ||
                      null) as ProfilePreferences["remotePolicy"],
                  )
                }
              >
                <option value="">{copy.none}</option>
                {REMOTE_POLICIES.map((r) => (
                  <option key={r} value={r}>
                    {copy.remotePolicies[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="travel">{copy.fields.travelTolerance}</Label>
              <select
                id="travel"
                className={selectClass}
                value={prefs.travelTolerance ?? ""}
                onChange={(e) =>
                  set(
                    "travelTolerance",
                    (e.target.value ||
                      null) as ProfilePreferences["travelTolerance"],
                  )
                }
              >
                <option value="">{copy.none}</option>
                {TRAVEL_TOLERANCES.map((tv) => (
                  <option key={tv} value={tv}>
                    {copy.travelTolerances[tv]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tz">{copy.fields.timezoneOverlap}</Label>
              <Input
                id="tz"
                value={prefs.timezoneOverlap ?? ""}
                placeholder={copy.hints.timezoneOverlap}
                onChange={(e) =>
                  set("timezoneOverlap", e.target.value.trim() || null)
                }
              />
            </div>
          </div>
          <ListField
            id="regions"
            label={copy.fields.allowedWorkRegions}
            hint={copy.hints.list}
            value={listToText(prefs.allowedWorkRegions)}
            onChange={(text) => set("allowedWorkRegions", textToList(text))}
          />
        </section>

        <section
          aria-label={copy.sections.exclusions}
          className="flex flex-col gap-4"
        >
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.sections.exclusions}
          </h2>
          <ListField
            id="exclusions"
            label={copy.fields.hardExclusions}
            hint={copy.hints.list}
            value={listToText(prefs.hardExclusions)}
            onChange={(text) => set("hardExclusions", textToList(text))}
          />
        </section>

        <div className="border-border/60 flex flex-wrap items-center gap-3 border-t pt-4">
          <Button type="submit" size="sm" {...busyProps}>
            {copy.save}
          </Button>
          <Link
            href="/profile"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {copy.backToProfile}
          </Link>
          {outcome === "saved" ? (
            <p role="status" className="text-sm">
              {copy.saved}
            </p>
          ) : null}
          {outcome === "error" ? (
            <p role="alert" className="text-destructive text-sm">
              {copy.error}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function ListField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
