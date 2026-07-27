import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import {
  assessReadiness,
  nextStep,
  type ReadinessInput,
} from "@/lib/profile/readiness";
import { discoveryConfigured } from "@/lib/discovery/sources";
import { t } from "@/lib/copy";
import { MAX_COUNTRIES_PER_SEARCH, SEARCH_COUNTRIES } from "@/domain/countries";
import { summariseUnderstanding } from "@/lib/profile/understood";
import { nextQuestion } from "@/lib/profile/next-question";
import {
  loadPendingCareer,
  loadSettledKeys,
} from "@/lib/profile/clarifications";
import { OnboardingStart } from "./onboarding-start";
import { linkedInConfigure } from "@/lib/profile/linkedin-oauth";
import { Mirror } from "./mirror";
import { NextQuestion } from "./next-question";
import { AutoResults } from "./auto-results";

export const metadata: Metadata = { title: "Mes opportunités" };

/**
 * The product, in one screen.
 *
 * Three states, and the order between them is the whole design:
 *
 * - **Nothing at all** — one sentence, one drop zone, and no other affordance
 *   on the page. Anything else here is a form standing between someone and the
 *   reason they came.
 * - **We read something, not yet enough** — the mirror: what we understood,
 *   said back, gaps included, THEN one question. Never the drop zone again;
 *   handing back an empty box to someone who just filled one is how a product
 *   teaches that effort disappears into it.
 * - **Enough to work with** — what the market has for them RIGHT NOW, searched
 *   before they asked, laid out as a staircase with the step up first.
 *
 * This screen replaces a dashboard of metrics ("N offres découvertes",
 * positioning charts) that measured the PRODUCT rather than serving the person.
 * Nobody arrives here to read a statistic about themselves.
 *
 * The switch is the readiness score, not a flag: the search opens where it
 * stops being noise, deliberately well before the profile is perfect, because
 * the first result is what makes someone want to finish the rest.
 */
export default async function HomePage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [living, preferences, settledKeys, careerQuestions] = await Promise.all(
    [
      loadLivingProfile(client, profile.id),
      loadPreferences(client, profile.id),
      loadSettledKeys(client, profile.id),
      loadPendingCareer(client, profile.id),
    ],
  );
  const copy = t().home;

  const confirmed = living.claims
    .filter((c) => c.state === "confirmed")
    .map((c) => ({ kind: c.kind, value: c.value }));
  const readinessInput: ReadinessInput = {
    confirmedClaims: confirmed,
    preferences: {
      targetRoleFamilies: preferences.targetRoleFamilies,
      allowedWorkRegions: preferences.allowedWorkRegions,
      preferredEngagementTypes: preferences.preferredEngagementTypes,
      remotePolicy: preferences.remotePolicy ?? null,
    },
    testimonialCount: living.evidence.filter((e) => e.type === "testimonial")
      .length,
    // The career reading happens inside the search, so at this point we only
    // know whether anything has been settled at all. An untouched profile
    // counts its trajectory as fully open rather than pretending otherwise.
    openTrajectoryQuestions: confirmed.length === 0 ? 3 : 0,
  };
  const readiness = assessReadiness(readinessInput);
  const step = nextStep(readiness);

  const countries = preferences.allowedWorkRegions
    .map((r) => r.trim().toLowerCase())
    .map(
      (r) =>
        SEARCH_COUNTRIES.find(
          (c) => c.code === r || c.label.toLowerCase() === r,
        )?.code,
    )
    .filter((c) => c !== undefined)
    .slice(0, MAX_COUNTRIES_PER_SEARCH);

  const understood = summariseUnderstanding(confirmed);
  const question = nextQuestion({
    readiness,
    understood,
    preferences: readinessInput.preferences,
    settledKeys,
    careerQuestions,
  });

  // ── Nothing at all: one invitation, nothing else ────────────────────────
  if (understood.empty) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8">
        <header className="flex flex-col gap-3">
          <h1
            id="dashboard-title"
            className="text-3xl font-semibold tracking-tight text-balance"
          >
            {copy.heroTitle}
          </h1>
          <p className="text-muted-foreground text-base text-pretty">
            {copy.heroLead}
          </p>
        </header>
        <OnboardingStart linkedInPret={linkedInConfigure()} />
        <p className="text-muted-foreground text-xs">{copy.heroPromise}</p>
      </div>
    );
  }

  // ── We read something, but not enough to search honestly ────────────────
  //
  // The state this exists to kill: someone uploads a CV, we extract their
  // skills, and the next screen hands them the same empty drop zone. Their
  // effort vanished. So the screen says what it now knows, then asks for ONE
  // more thing — and the mirror comes first, because a question from someone
  // who just proved they were listening is a different question entirely.
  if (!readiness.canSearch) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8">
        <header className="flex flex-col gap-3">
          <h1
            id="dashboard-title"
            className="text-3xl font-semibold tracking-tight text-balance"
          >
            {copy.mirrorTitle}
          </h1>
          <p className="text-muted-foreground text-base text-pretty">
            {copy.mirrorLead}
          </p>
        </header>

        <Mirror understood={understood} />

        {/* The mirror proved we listened; NOW one question is fair to ask. */}
        {question ? (
          <NextQuestion question={question} />
        ) : step ? (
          <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm">{copy.mirrorAsk(step.ask)}</p>
            <Link
              href="/profile"
              className="text-sm underline underline-offset-2"
            >
              {copy.mirrorAskLink}
            </Link>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">{copy.heroPromise}</p>
      </div>
    );
  }

  // ── Enough to work with: the market, now ────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1
          id="dashboard-title"
          className="text-2xl font-semibold tracking-tight"
        >
          {copy.resultsTitle}
        </h1>
        <p className="text-muted-foreground text-sm">{copy.resultsLead}</p>
      </header>

      {/* ONE nudge, never a list of gaps: a wall of eight missing things is
          where people stop. And it stays a quiet line under the title — the
          opportunities are what this page is for. */}
      {step ? (
        <p className="text-muted-foreground text-xs">
          {copy.nudge(readiness.score, step.ask)}{" "}
          <Link href="/profile" className="underline underline-offset-2">
            {copy.nudgeLink}
          </Link>
        </p>
      ) : null}

      {/* The conversation does not stop once the search opens — that is the
          point. Each answer re-filters the list SHOWN BELOW IT, which is the
          only reason a question is worth someone's time. Asking everything up
          front and searching afterwards is the form we refused to build. */}
      {question ? <NextQuestion question={question} /> : null}

      {discoveryConfigured() ? (
        <Suspense
          fallback={
            <p role="status" className="text-muted-foreground text-sm">
              {copy.searching}
            </p>
          }
        >
          <AutoResults countries={countries} />
        </Suspense>
      ) : (
        <p className="text-muted-foreground text-sm">{copy.unconfigured}</p>
      )}
    </div>
  );
}
