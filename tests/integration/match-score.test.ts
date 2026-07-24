import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { ProfilePreferences } from "@/domain/profile";
import { getOpportunity, importPastedText } from "@/lib/opportunity/logic";
import {
  getOwnProfile,
  loadLivingProfile,
  loadPreferences,
  savePreferences,
  setClaimState,
  submitClaim,
} from "@/lib/profile/logic";
import { opportunityFactsFromRow } from "@/lib/matching/hard-constraints";
import { profileSignalsFromClaims, scoreMatch } from "@/lib/matching/score";

// Integration proof: deterministic match scoring end-to-end through a REAL
// session — saved prefs + a CONFIRMED skill + a normalized opportunity, read
// back under RLS and scored. Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p3-eve-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let eveId: string;
let eveProfileId: string;
let eve: ReturnType<typeof sessionClient>;

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PREFS: ProfilePreferences = {
  targetRoleFamilies: [],
  preferredEngagementTypes: ["freelance"],
  languages: [],
  allowedWorkRegions: [],
  hardExclusions: [],
  targetDayRate: 700,
  minimumDayRate: 500,
  baseCurrency: "EUR",
  remotePolicy: "remote_only",
  timezoneOverlap: null,
  travelTolerance: null,
};

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  eveId = created.data.user.id;
  eve = sessionClient();
  await eve.auth.signInWithPassword({ email, password });
  eveProfileId = (await getOwnProfile(eve)).id;
  await savePreferences(eve, eveProfileId, PREFS);
  // A confirmed skill the scorer can credit as evidence.
  const claimId = await submitClaim(eve, eveProfileId, "skill", { name: "Go" });
  await setClaimState(eve, claimId, "confirmed");
});

afterAll(async () => {
  if (eveId) await admin.auth.admin.deleteUser(eveId);
});

describe("match scoring (through the DB, RLS + real extraction)", () => {
  it("credits the covered skill as evidence and produces an overall score", async () => {
    const imported = await importPastedText(
      eve,
      `Senior Go Engineer
chez Acme

Remote

TJM: 800 €/jour

Skills:
- Go
- Kubernetes`,
    );
    const [opp, prefs, living] = await Promise.all([
      getOpportunity(eve, imported.opportunity_id),
      loadPreferences(eve, eveProfileId),
      loadLivingProfile(eve, eveProfileId),
    ]);
    const score = scoreMatch(
      prefs,
      profileSignalsFromClaims(living.claims),
      opportunityFactsFromRow(opp!),
    );

    const skills = score.components.find((c) => c.key === "skills")!;
    expect(skills.score).toBe(50); // 1 of 2 demanded skills covered
    expect(skills.evidence).toContain("Go");
    expect(score.overall).not.toBeNull();
    expect(score.confidence).not.toBe("none");
  });
});
