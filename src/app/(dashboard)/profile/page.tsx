import type { Metadata } from "next";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import {
  getOwnProfile,
  listVersions,
  loadLivingProfile,
} from "@/lib/profile/logic";
import type { ClaimKind, ClaimState } from "@/domain/profile";
import { CvImport } from "./cv-import";
import { ProfileInterview } from "./profile-interview";

export const metadata: Metadata = { title: "Profil & Preuves" };

/**
 * The guided professional interview — the first real business vertical.
 * Server side: DAL boundary + living-state read; every projection and
 * decision recomputes from this state (the thread is a projection, never a
 * persisted chat log).
 */
export default async function ProfilePage() {
  await verifySession();
  const client = await createClient();
  const profile = await getOwnProfile(client);
  const living = await loadLivingProfile(client, profile.id);
  const versions = await listVersions(client, profile.id);

  return (
    <div className="flex flex-col gap-6">
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
