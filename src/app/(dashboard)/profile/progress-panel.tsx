import Link from "next/link";
import type { Progression } from "@/lib/profile/progression";
import type { AdviceItem } from "@/lib/profile/linkedin-advice";
import type { ProfileQuestion } from "@/lib/profile/next-question";

/**
 * The profile as a plan of work, not a form.
 *
 * Three things, in the order that respects someone's time:
 *
 * 1. **What you already unlocked.** Capabilities, not a percentage. The bar
 *    exists to show movement; the sentence carries the meaning.
 * 2. **What is still owed** — the remaining questions, listed so the road is
 *    visible, even though only one is ever asked at a time on the home screen.
 * 3. **How to be stronger** — concrete, grounded in what we read about them.
 *
 * Nothing here scolds. A profile that is thin is a profile we have not
 * finished reading yet, which is our situation to fix, not their failing.
 */
export function ProgressPanel({
  progress,
  questions,
  advice,
}: {
  progress: Progression;
  questions: ProfileQuestion[];
  advice: AdviceItem[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="progress-heading"
        className="border-border flex flex-col gap-4 rounded-lg border p-5"
      >
        <h2 id="progress-heading" className="text-base font-medium">
          Ce que votre profil vous ouvre
        </h2>

        {/* Presentational only — the list below carries the real meaning, and
            the bar is never labelled with a bare figure. */}
        <div
          aria-hidden="true"
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-foreground h-full rounded-full"
            style={{ width: `${progress.fill}%` }}
          />
        </div>

        {/* The history lives here, not inside the folded interview where it
            became unreachable. Being able to see what this product recorded
            about you, and when, is not an advanced feature — it is the
            counterpart of asking someone to hand over their career. */}
        <p className="text-muted-foreground text-xs">
          <Link
            href="/profile/history"
            className="underline underline-offset-2"
          >
            Historique
          </Link>{" "}
          — ce que nous avons enregistré, et quand.
        </p>

        <ul className="flex flex-col gap-2">
          {progress.tiers.map((tier) => (
            <li key={tier.key} className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className="mt-0.5">
                {tier.reached ? "✓" : "○"}
              </span>
              <span className={tier.reached ? "" : "text-muted-foreground"}>
                {tier.unlocks}
                {tier.reached ? (
                  <span className="sr-only"> — débloqué</span>
                ) : (
                  <span className="sr-only"> — pas encore débloqué</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {questions.length > 0 ? (
        <section
          aria-labelledby="remaining-heading"
          className="border-border flex flex-col gap-3 rounded-lg border p-5"
        >
          <h2 id="remaining-heading" className="text-base font-medium">
            Ce que je ne sais pas encore
          </h2>
          <p className="text-muted-foreground text-sm">
            Je vous les pose une par une sur l&apos;écran d&apos;accueil, jamais
            toutes à la fois.{" "}
            <Link href="/dashboard" className="underline underline-offset-2">
              Répondre à la suivante
            </Link>
          </p>
          <ul className="flex flex-col gap-1.5">
            {questions.map((question) => (
              <li key={question.key} className="text-muted-foreground text-sm">
                {question.prompt}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {advice.length > 0 ? (
        <section
          aria-labelledby="advice-heading"
          className="border-border flex flex-col gap-4 rounded-lg border p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="advice-heading" className="text-base font-medium">
              Renforcer votre présence en ligne
            </h2>
            <p className="text-muted-foreground text-sm">
              Chacun de ces points vient de ce que nous avons lu chez vous. À
              appliquer vous-même : nous ne touchons jamais à votre profil
              LinkedIn.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {advice.map((item) => (
              <li key={item.key} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{item.action}</p>
                <p className="text-muted-foreground text-sm text-pretty">
                  {item.grounds}
                </p>
                {item.draft !== null ? (
                  <pre className="bg-muted mt-1 max-w-full overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                    {item.draft}
                  </pre>
                ) : null}
                {item.follow !== null ? (
                  <Link
                    href={item.follow.href}
                    className="mt-1 self-start text-sm underline underline-offset-2"
                  >
                    {item.follow.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
