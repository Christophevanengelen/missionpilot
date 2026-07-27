"use client";

import { useState } from "react";
import { CvImport } from "../profile/cv-import";

/**
 * The first screen: ONE question, two answers.
 *
 * What it replaces: a screen that offered four ways to begin at once — a PDF
 * field, a paste box, a LinkedIn archive field, and two buttons — to someone
 * who had not yet been shown a single result. Every added field costs
 * completion, and a first screen is where that cost is highest.
 *
 * Choosing is not a form step, it is the whole step: pick a path and only that
 * path appears. And the choice is reversible in one click, because a first
 * screen that traps you is worse than one that asks twice.
 *
 * LinkedIn is deliberately the SECOND option and says "export", not "connect".
 * There is no connect: the API that would import a career is closed to a
 * project without a verified company, and the self-service one returns exactly
 * what the archive already contains. Naming it "connect" would promise a
 * button that cannot exist — see docs/linkedin-import.md.
 */
export function OnboardingStart({
  linkedInPret = false,
}: { linkedInPret?: boolean } = {}) {
  const [choice, setChoice] = useState<"cv" | "linkedin" | null>(null);

  if (choice !== null) {
    return (
      <div className="flex flex-col gap-3">
        <CvImport only={choice} linkedInPret={linkedInPret} />
        <button
          type="button"
          onClick={() => setChoice(null)}
          className="text-muted-foreground self-start text-xs underline underline-offset-2"
        >
          Choisir l&apos;autre méthode
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="start" className="flex flex-col gap-4">
      <h2 id="start" className="text-base font-medium">
        Par quoi commence-t-on ?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setChoice("cv")}
          className="border-border hover:border-foreground/40 flex flex-col gap-1 rounded-lg border p-4 text-left motion-safe:transition-colors"
        >
          <span className="font-medium">Mon CV</span>
          <span className="text-muted-foreground text-sm text-pretty">
            Un PDF, ou son texte collé. Le fichier n&apos;est jamais conservé.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setChoice("linkedin")}
          className="border-border hover:border-foreground/40 flex flex-col gap-1 rounded-lg border p-4 text-left motion-safe:transition-colors"
        >
          <span className="font-medium">
            {linkedInPret ? "Remplir avec LinkedIn" : "Mon export LinkedIn"}
          </span>
          <span className="text-muted-foreground text-sm text-pretty">
            Votre propre archive officielle. Elle contient vos recommandations,
            que votre CV n&apos;a pas.
          </span>
        </button>
      </div>
      <p className="text-muted-foreground text-xs text-pretty">
        Rien n&apos;est récupéré automatiquement chez LinkedIn : il
        n&apos;existe aucune connexion qui donnerait accès à votre parcours.
        C&apos;est vous qui déposez votre export.
      </p>
    </section>
  );
}
