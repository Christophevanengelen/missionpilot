import type { Metadata } from "next";
import { Suspense } from "react";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadPreferences } from "@/lib/profile/logic";
import { discoveryConfigured } from "@/lib/discovery/sources";
import { t } from "@/lib/copy";
import { MAX_COUNTRIES_PER_SEARCH, SEARCH_COUNTRIES } from "@/domain/countries";
import { AutoResults } from "./auto-results";

export const metadata: Metadata = { title: "Recherche" };

/**
 * What the market has for you today — already searched when you arrive.
 *
 * The product is deliberately NOT a search box. The scope was understood once,
 * at onboarding, from the CV and the conditions the user accepts; from then on
 * the engine works unattended, and the only gesture left is clicking through to
 * an offer on the platform that published it. Asking the user to press
 * "Search" would put the work back on the person we are meant to be working
 * for.
 *
 * The search runs inside a Suspense boundary so the shell paints immediately
 * and results land when the sources answer, instead of the page hanging on a
 * multi-source fan-out. Nothing is stored: the profile is remembered, the
 * offers are not.
 */
export default async function SearchPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const preferences = await loadPreferences(client, profile.id);
  const copy = t().search;
  // Seed from the saved work regions when they name a country we can query;
  // otherwise leave it empty and let the deployment default answer, rather
  // than picking a country on the owner's behalf.
  const defaultCountries = preferences.allowedWorkRegions
    .map((r) => r.trim().toLowerCase())
    .map(
      (r) =>
        SEARCH_COUNTRIES.find(
          (c) => c.code === r || c.label.toLowerCase() === r,
        )?.code,
    )
    .filter((c) => c !== undefined)
    .slice(0, MAX_COUNTRIES_PER_SEARCH);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
      </header>

      {discoveryConfigured() ? (
        <Suspense
          fallback={
            <p role="status" className="text-muted-foreground text-sm">
              {copy.loading}
            </p>
          }
        >
          <AutoResults countries={defaultCountries} />
        </Suspense>
      ) : (
        <p className="text-muted-foreground text-sm">{copy.unconfigured}</p>
      )}
    </div>
  );
}
