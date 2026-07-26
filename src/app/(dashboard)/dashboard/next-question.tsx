"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { answerQuestionAction } from "@/lib/profile/question-actions";
import type { ProfileQuestion } from "@/lib/profile/next-question";
import { t } from "@/lib/copy";

/**
 * One question. Not a form.
 *
 * The design decisions here are the measured ones, and each is deliberate:
 *
 * **One at a time.** Every required field costs conversion, and a screen of
 * seven of them is where people close the tab. Whatever else is missing waits.
 *
 * **"Je ne sais pas" comes FIRST, and it is a real button.** A required
 * question with no way out does not produce knowledge — it produces invented
 * answers, from roughly a quarter of people. An explicit, respectable escape
 * roughly halves that, and it costs us nothing: not knowing is simply recorded
 * and never asked again.
 *
 * **The reason is stated before the answer is taken.** "Sans ce mot, je n'ai
 * rien à chercher" is a reason; "pour compléter votre profil" is our
 * bookkeeping dressed up as their benefit.
 *
 * **A rejected answer does not consume the question.** If we cannot read it,
 * we say so and leave it open — losing someone's answer because our parser was
 * narrow would be our failure charged to them.
 */
export function NextQuestion({ question }: { question: ProfileQuestion }) {
  const copy = t().home;
  const [free, setFree] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(answer: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await answerQuestionAction({
        questionKey: question.key,
        question: question.prompt,
        // The key carries its own origin ("gap:role", "career:…"), so the two
        // never get filed under the wrong one.
        origin: question.key.startsWith("career:") ? "career" : "gap",
        target: question.target,
        answer,
      });
      if (!result.ok) {
        setError(
          result.error === "failed" ? copy.answerFailed : copy.answerUnreadable,
        );
        return;
      }
      setFree("");
    });
  }

  return (
    <section
      aria-labelledby="next-question"
      className="border-border flex flex-col gap-4 rounded-lg border p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="next-question" className="text-base font-medium text-pretty">
          {question.prompt}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {question.because}
        </p>
      </div>

      {question.options.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {question.options.map((option) => (
            <li key={option.value}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => send(option.value)}
              >
                {option.label}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {question.placeholder !== null ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(free);
          }}
        >
          <div className="flex min-w-52 flex-1 flex-col gap-1">
            <label htmlFor="free-answer" className="sr-only">
              {question.prompt}
            </label>
            <Input
              id="free-answer"
              value={free}
              disabled={pending}
              placeholder={question.placeholder}
              onChange={(event) => setFree(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={pending || free.trim() === ""}
          >
            {copy.answerSubmit}
          </Button>
        </form>
      ) : null}

      {error !== null ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {/* Last in the DOM, but offered without shame: a quiet "skip" link is an
          invitation to lie, whereas a plain button is an honest option. */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => send(null)}
        >
          {copy.answerDontKnow}
        </Button>
      </div>
    </section>
  );
}
