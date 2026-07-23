import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import type { ProfilePreferences } from "@/domain/profile";
import { getOpportunity, importPastedText } from "@/lib/opportunity/logic";
import {
  getOwnProfile,
  loadPreferences,
  savePreferences,
} from "@/lib/profile/logic";
import {
  evaluateHardConstraints,
  opportunityFactsFromRow,
} from "@/lib/matching/hard-constraints";

// Integration proof: the hard-constraint engine run end-to-end through a REAL
// authenticated session — saved preferences + a normalized opportunity read
// back under RLS, then evaluated. Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p3-dana-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let danaId: string;
let danaProfileId: string;
let dana: ReturnType<typeof sessionClient>;

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PREFS: ProfilePreferences = {
  targetRoleFamilies: [],
  preferredEngagementTypes: [],
  languages: [],
  allowedWorkRegions: [],
  hardExclusions: ["casino"],
  targetDayRate: null,
  minimumDayRate: 600,
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
  danaId = created.data.user.id;
  dana = sessionClient();
  await dana.auth.signInWithPassword({ email, password });
  danaProfileId = (await getOwnProfile(dana)).id;
  await savePreferences(dana, danaProfileId, PREFS);
});

afterAll(async () => {
  if (danaId) await admin.auth.admin.deleteUser(danaId);
});

async function gateFor(rawText: string) {
  const imported = await importPastedText(dana, rawText);
  const [opp, prefs] = await Promise.all([
    getOpportunity(dana, imported.opportunity_id),
    loadPreferences(dana, danaProfileId),
  ]);
  return evaluateHardConstraints(prefs, opportunityFactsFromRow(opp!));
}

describe("hard-constraint engine (through the DB, RLS + real extraction)", () => {
  it("excludes an opportunity that breaks a hard constraint", async () => {
    const report = await gateFor(
      `Casino Floor Manager
chez LasVegasCorp

Location: Paris
On-site

TJM: 400 €/jour`,
    );
    expect(report.gate).toBe("excluded");
    const exclusion = report.checks.find((c) => c.key === "hard_exclusions")!;
    expect(exclusion.verdict).toBe("violated");
    expect(exclusion.detail).toBe("casino");
  });

  it("does not exclude a clean remote, well-paid opportunity", async () => {
    const report = await gateFor(
      `Senior Platform Engineer
chez Globex

Remote

TJM: 800 €/jour`,
    );
    // No hard rule is broken; it is eligible or (if a field is unknown) review,
    // but never excluded.
    expect(report.gate).not.toBe("excluded");
    expect(
      report.checks.find((c) => c.key === "hard_exclusions")!.verdict,
    ).toBe("pass");
  });
});
