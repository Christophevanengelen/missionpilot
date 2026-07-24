import type { Metadata } from "next";
import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, loadLivingProfile } from "@/lib/profile/logic";
import { t } from "@/lib/copy";
import { RecommendationForm } from "./recommendation-form";

export const metadata: Metadata = { title: "Recommandations reçues" };

const isHttpUrl = (u: string | null): u is string =>
  typeof u === "string" && /^https?:\/\//i.test(u.trim());

/**
 * Received recommendations (peer proof) as `testimonial` evidence. The user
 * pastes their own recommendation + an optional verification link; the app
 * never fetches or scrapes anything. Server-rendered (RLS: own rows).
 */
export default async function RecommendationsPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const living = await loadLivingProfile(client, profile.id);
  const copy = t().recommendations;

  const testimonials = living.evidence.filter((e) => e.type === "testimonial");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      <RecommendationForm />

      <section aria-label={copy.listLabel} className="flex flex-col gap-3">
        {testimonials.length === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.empty}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {testimonials.map((e) => {
              const meta = [e.role_played, e.organization]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={e.id}>
                  <article className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-sm font-semibold">{e.title}</h2>
                      {isHttpUrl(e.source_reference) ? (
                        <a
                          href={e.source_reference}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-primary shrink-0 text-xs underline underline-offset-4"
                        >
                          {copy.verify}
                        </a>
                      ) : (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {copy.noSource}
                        </span>
                      )}
                    </div>
                    {meta ? (
                      <p className="text-muted-foreground text-xs">{meta}</p>
                    ) : null}
                    <p className="text-sm whitespace-pre-line">{e.statement}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p>
        <Link
          href="/profile"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {copy.backToProfile}
        </Link>
      </p>
    </div>
  );
}
