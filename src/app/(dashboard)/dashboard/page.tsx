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
import { lireAbonnement } from "@/lib/digest/abonnement";
import { mailConfigure } from "@/lib/mail/resend";
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
 * Un filet, pas un permis.
 *
 * Cette route n'en déclarait aucun, et héritait donc d'un plafond de plateforme
 * que rien ici ne documentait — celui contre lequel le rendu du 2026-07-29 est
 * mort en cours de stream, vers 19 s, sans la moindre erreur applicative : un
 * dépassement de durée ne passe pas par le logger, il coupe la fonction.
 *
 * Ce n'est PAS la correction. La correction est que le rendu tienne : le plan
 * précalculé est borné à quatre recherches (`MAX_SEARCH_PLANS`), les sources
 * sans mots-clés ne sont plus interrogées qu'une fois, et le seul appel de
 * modèle restant a huit secondes (`TRIAGE_TIMEOUT_MS`). Le chiffre ci-dessous
 * ne sert qu'à ce qu'un imprévu dégrade la page au lieu de la supprimer.
 *
 * Soixante et pas davantage : c'est ce que le palier gratuit autorise, et une
 * page qui mettrait une minute serait de toute façon à corriger, pas à tolérer.
 */
export const maxDuration = 60;

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

  /* Proposé UNE SEULE FOIS, et seulement si l'envoi est réellement possible :
     offrir un service qu'on ne peut pas rendre est pire que de se taire. */
  const digestPossible = mailConfigure();
  const dejaAbonne = digestPossible
    ? ((await lireAbonnement(client, profile.id))?.optedIn ?? false)
    : true;

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
          {copy.nudge(step.dimension, step.ask)}{" "}
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

      {/* SOUS les offres, jamais au-dessus. Quelqu'un qui vient de voir ce que
          le marché a pour lui est le seul à qui cette proposition veut dire
          quelque chose — et cet écran existe pour montrer des opportunités,
          pas pour vendre une option. Une ligne, puis plus jamais. */}
      {digestPossible && !dejaAbonne ? (
        <p className="text-muted-foreground border-border border-t pt-4 text-xs">
          {copy.digestOffer}{" "}
          <Link href="/compte" className="underline underline-offset-2">
            {copy.digestOfferLink}
          </Link>
        </p>
      ) : null}

      {/* PAS DE PARTAGE ICI, et c'est un retrait délibéré : il y en avait un,
          il n'y est plus. Cet écran est celui de quelqu'un qui cherche un
          emploi — le plus souvent en poste, et sans que son employeur le
          sache. Même en ne partageant que l'outil, poser le geste AU MILIEU
          des offres met un doute à un clic : « est-ce que ça publie ce que je
          regarde ? ». La question suffit à abîmer l'écran, et sa réponse
          rassurante ne se lit qu'après.
          Le partage vit sur la page publique, où l'on ne cherche pas encore. */}
    </div>
  );
}
