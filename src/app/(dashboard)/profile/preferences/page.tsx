import type { Metadata } from "next";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { getOwnProfile, loadPreferences } from "@/lib/profile/logic";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Préférences & contraintes" };

/**
 * Target preferences & hard constraints (PR E) — the profile's live
 * positioning, read by the future matching engine. Server side: DAL
 * boundary + own-profile resolution + preferences read; the client form
 * renders from this and saves through the sanitized server action.
 */
export default async function PreferencesPage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const preferences = await loadPreferences(client, profile.id);

  return <PreferencesForm initial={preferences} />;
}
