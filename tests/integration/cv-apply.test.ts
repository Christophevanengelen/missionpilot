import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import { addCvSkills, applyCvProfile } from "@/lib/profile/cv-apply";
import {
  getOwnProfile,
  loadLivingProfile,
  loadPreferences,
  submitClaim,
} from "@/lib/profile/logic";

// Integration proof: the one-click "voici ce que j'ai compris" application —
// claims created AND confirmed, target métiers stored in preferences, and a
// re-analysis superseding the previous single-valued claims — through a REAL
// session (RLS in force). Requires `supabase start`.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `p5-apply-${randomUUID()}@test.local`;
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

describe("applyCvProfile (through the DB, RLS)", () => {
  it("creates CONFIRMED claims and stores target métiers in one step", async () => {
    const { confirmed } = await applyCvProfile(session, profileId, {
      roleTitle: "Data Engineer",
      seniorityLevel: "Senior",
      yearsExperience: 9,
      summary: "Ingénieur data senior, pipelines analytiques à l'échelle.",
      skills: ["Spark", "Airflow", "Python"],
      targetRoles: ["Data Engineer", "Analytics Engineer"],
    });
    expect(confirmed).toBe(7); // role + seniority + years + summary + 3 skills

    const living = await loadLivingProfile(session, profileId);
    const byKind = (k: string) =>
      living.claims.filter((c) => c.kind === k && c.state === "confirmed");
    expect((byKind("role")[0]?.value as { title?: string })?.title).toBe(
      "Data Engineer",
    );
    expect(byKind("seniority")).toHaveLength(1);
    expect(byKind("years_experience")).toHaveLength(1);
    expect(byKind("summary")).toHaveLength(1);
    expect(byKind("skill")).toHaveLength(3);

    const prefs = await loadPreferences(session, profileId);
    expect(prefs.targetRoleFamilies).toEqual([
      "Data Engineer",
      "Analytics Engineer",
    ]);
  });

  it("re-analysis supersedes single-valued claims and skips known skills", async () => {
    const { confirmed } = await applyCvProfile(session, profileId, {
      roleTitle: "Head of Data",
      seniorityLevel: "Lead",
      yearsExperience: 10,
      summary: "Direction data et plateformes analytiques.",
      skills: ["Spark", "dbt"], // Spark already present ⇒ only dbt is new
      targetRoles: ["Head of Data"],
    });
    expect(confirmed).toBe(5); // role + seniority + years + summary + dbt

    const living = await loadLivingProfile(session, profileId);
    const activeRoles = living.claims.filter((c) => c.kind === "role");
    // The previous role was superseded — exactly one ACTIVE role remains.
    expect(activeRoles).toHaveLength(1);
    expect((activeRoles[0].value as { title?: string })?.title).toBe(
      "Head of Data",
    );
    expect(
      living.claims.filter(
        (c) => c.kind === "skill" && c.state === "confirmed",
      ),
    ).toHaveLength(4); // Spark, Airflow, Python + dbt

    const prefs = await loadPreferences(session, profileId);
    expect(prefs.targetRoleFamilies).toEqual(["Head of Data"]);
  });

  it("a kept selection CONFIRMS an existing proposed skill (no silent no-op)", async () => {
    // A skill added through the old chip flow sits in state "proposed".
    await submitClaim(session, profileId, "skill", { name: "Kafka" });

    const { confirmed } = await applyCvProfile(session, profileId, {
      roleTitle: "Head of Data",
      seniorityLevel: "Lead",
      yearsExperience: 10,
      summary: "Direction data et plateformes analytiques.",
      skills: ["Kafka"], // kept selected on the review screen
      targetRoles: ["Head of Data"],
    });
    // role + seniority + years + summary + the CONFIRMED Kafka claim.
    expect(confirmed).toBe(5);

    const living = await loadLivingProfile(session, profileId);
    const kafka = living.claims.find(
      (c) =>
        c.kind === "skill" && (c.value as { name?: string })?.name === "Kafka",
    );
    expect(kafka?.state).toBe("confirmed");
  });
});

describe("addCvSkills — chip flow (through the DB, RLS)", () => {
  it("the kept chip selection lands CONFIRMED (the selection is the validation)", async () => {
    // One pre-existing proposal (e.g. from the interview) that the user keeps
    // selected on the chip screen — it must be confirmed, not no-oped.
    await submitClaim(session, profileId, "skill", { name: "Terraform" });

    const { added } = await addCvSkills(session, profileId, [
      "Terraform", // proposed → confirmed
      "Kubernetes", // new → created confirmed
      "Spark", // already confirmed → nothing, not counted
    ]);
    expect(added).toBe(2);

    const living = await loadLivingProfile(session, profileId);
    const byName = (name: string) =>
      living.claims.find(
        (c) =>
          c.kind === "skill" && (c.value as { name?: string })?.name === name,
      );
    expect(byName("Terraform")?.state).toBe("confirmed");
    expect(byName("Kubernetes")?.state).toBe("confirmed");
    expect(byName("Spark")?.state).toBe("confirmed");
  });
});
