import type { Metadata } from "next";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { loadPreferences } from "@/lib/profile/logic";
import { discoveryConfigured } from "@/lib/discovery/sources";
import { t } from "@/lib/copy";
import { MAX_COUNTRIES_PER_SEARCH, SEARCH_COUNTRIES } from "@/domain/countries";
import { SearchPanel } from "./search-panel";

export const metadata: Metadata = { title: "Recherche" };

/**
 * The market search screen — a photograph of what is open RIGHT NOW across the
 * configured platforms, as outbound links to the original postings. Nothing
 * here is stored: the user keeps what they choose to keep.
 *
 * The search box is pre-filled with the first métier the validated CV analysis
 * chose, so arriving with a CV already on file means arriving one click from
 * results.
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
        <SearchPanel
          defaultQuery={preferences.targetRoleFamilies[0] ?? ""}
          defaultCountries={defaultCountries}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{copy.unconfigured}</p>
      )}
    </div>
  );
}
