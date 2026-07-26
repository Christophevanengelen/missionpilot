import type { Metadata } from "next";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import {
  getOwnProfile,
  listVersions,
  loadLivingProfile,
  loadPreferences,
} from "@/lib/profile/logic";
import { assessReadiness } from "@/lib/profile/readiness";
import { progression } from "@/lib/profile/progression";
import { summariseUnderstanding } from "@/lib/profile/understood";
import { pendingQuestions } from "@/lib/profile/next-question";
import {
  loadPendingCareer,
  loadSettledKeys,
} from "@/lib/profile/clarifications";
import { linkedinAdvice } from "@/lib/profile/linkedin-advice";
import type { ClaimKind, ClaimState } from "@/domain/profile";
import { CvImport } from "./cv-import";
import { ProgressPanel } from "./progress-panel";
import { ProfileInterview } from "./profile-interview";

export const metadata: Metadata = { title: "Mon profil" };

/**
 * The profile, as a place someone gets STRONGER — not a settings screen.
 *
 * The order is the argument: what you have already unlocked, what I still do
 * not know, and how to be a better candidate. The guided interview stays
 * underneath for anyone who wants to go deeper, but nobody has to pass through
 * a form to learn where they stand.
 */
export default async function ProfilePage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const [living, versions, preferences, settledKeys, careerQuestions] =
    await Promise.all([
      loadLivingProfile(client, profile.id),
      listVersions(client, profile.id),
      loadPreferences(client, profile.id),
      loadSettledKeys(client, profile.id),
      loadPendingCareer(client, profile.id),
    ]);

  const confirmed = living.claims
    .filter((c) => c.state === "confirmed")
    .map((c) => ({ kind: c.kind, value: c.value }));
  const testimonialCount = living.evidence.filter(
    (e) => e.type === "testimonial",
  ).length;
  const prefs = {
    targetRoleFamilies: preferences.targetRoleFamilies,
    allowedWorkRegions: preferences.allowedWorkRegions,
    preferredEngagementTypes: preferences.preferredEngagementTypes,
    remotePolicy: preferences.remotePolicy ?? null,
  };
  const readiness = assessReadiness({
    confirmedClaims: confirmed,
    preferences: prefs,
    testimonialCount,
    openTrajectoryQuestions: confirmed.length === 0 ? 3 : 0,
  });
  const understood = summariseUnderstanding(confirmed);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ProgressPanel
        progress={progression(readiness, {
          hasRole: understood.lines.some(
            (l) => l.kind === "role" && l.value !== null,
          ),
          hasSeniority: understood.lines.some(
            (l) => l.kind === "seniority" && l.value !== null,
          ),
          hasYears: understood.lines.some(
            (l) => l.kind === "years_experience" && l.value !== null,
          ),
          achievementCount: confirmed.filter((c) => c.kind === "achievement")
            .length,
        })}
        questions={pendingQuestions({
          readiness,
          understood,
          preferences: prefs,
          settledKeys,
          careerQuestions,
        })}
        advice={linkedinAdvice({
          understood,
          testimonialCount,
          achievementCount: confirmed.filter((c) => c.kind === "achievement")
            .length,
        })}
      />
      <CvImport />
      <ProfileInterview
        latestVersionNumber={versions[0]?.version_number ?? null}
        claims={living.claims.map((c) => ({
          id: c.id,
          kind: c.kind as ClaimKind,
          value: c.value as Record<string, unknown>,
          state: c.state as ClaimState,
        }))}
        evidence={living.evidence.map((e) => ({
          id: e.id,
          title: e.title,
          statement: e.statement,
          role_played: e.role_played,
          verification_status: e.verification_status,
          state: e.state as ClaimState,
        }))}
        links={living.links}
      />
    </div>
  );
}
