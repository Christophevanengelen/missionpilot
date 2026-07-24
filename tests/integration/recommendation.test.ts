import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import { evidenceInputSchema } from "@/domain/profile";
import {
  createEvidence,
  getOwnProfile,
  loadLivingProfile,
} from "@/lib/profile/logic";
import { buildTestimonialEvidence } from "@/lib/profile/recommendation";

// Integration proof: a pasted recommendation becomes a `testimonial` evidence
// item — with its verification link — through a REAL authenticated session
// (RLS in force). Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p4-rec-${randomUUID()}@test.local`;
const password = `synthetic-${randomUUID()}`;
let userId: string;
let profileId: string;
let session: ReturnType<typeof sessionClient>;

function sessionClient() {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`fixture user failed: ${created.error?.message}`);
  }
  userId = created.data.user.id;
  session = sessionClient();
  await session.auth.signInWithPassword({ email, password });
  profileId = (await getOwnProfile(session)).id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("recommendation → testimonial evidence (through the DB, RLS)", () => {
  it("stores a testimonial with its verification link", async () => {
    const evidence = evidenceInputSchema.parse(
      buildTestimonialEvidence({
        recommender: "Jane Doe",
        relationship: "ex-manager",
        organization: "Globex",
        text: "Outstanding senior engineer — delivered the platform migration.",
        sourceUrl: "https://www.linkedin.com/in/janedoe/",
      }),
    );
    const id = await createEvidence(session, profileId, evidence);

    const living = await loadLivingProfile(session, profileId);
    const stored = living.evidence.find((e) => e.id === id);
    expect(stored).toBeTruthy();
    expect(stored!.type).toBe("testimonial");
    expect(stored!.title).toBe("Jane Doe");
    expect(stored!.statement).toContain("Outstanding senior engineer");
    expect(stored!.source_type).toBe("url");
    expect(stored!.source_reference).toBe(
      "https://www.linkedin.com/in/janedoe/",
    );
    expect(stored!.verification_status).toBe("user_confirmed");
  });
});
