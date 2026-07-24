/**
 * Apply an understood CV profile in one validated step. Parameterized by the
 * SESSION client (RLS in force) and pure of Next.js request context so
 * integration tests exercise the exact production logic.
 *
 * The user reviewed the "voici ce que j'ai compris" screen — that single
 * validation is the honest confirmation, so claims are created AND confirmed.
 * Single-valued kinds supersede their active predecessor through the normal
 * replacement lifecycle (re-analysis just works). Target métiers land in
 * preferences.targetRoleFamilies to drive auto-discovery.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/db/database.types";
import {
  loadLivingProfile,
  loadPreferences,
  savePreferences,
  setClaimState,
  submitClaim,
} from "./logic";

type Client = SupabaseClient<Database>;

export const applyProfileSchema = z.object({
  roleTitle: z.string().trim().min(1).max(200),
  seniorityLevel: z.string().trim().min(1).max(100).nullable(),
  yearsExperience: z.number().int().min(0).max(80).nullable(),
  summary: z.string().trim().min(1).max(2000),
  /** The skills the user KEPT selected on the review screen. */
  skills: z.array(z.string().trim().min(1).max(120)).max(30),
  targetRoles: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
});

export type ApplyProfileInput = z.infer<typeof applyProfileSchema>;

export async function applyCvProfile(
  client: Client,
  profileId: string,
  input: ApplyProfileInput,
): Promise<{ confirmed: number }> {
  const living = await loadLivingProfile(client, profileId);
  let confirmed = 0;

  const confirmClaim = async (
    kind: "role" | "seniority" | "years_experience" | "summary" | "skill",
    value: unknown,
  ) => {
    // Re-analysis: a single-valued kind may already have an ACTIVE claim —
    // supersede it through the normal replacement lifecycle.
    const activeSameKind =
      kind === "skill"
        ? undefined
        : living.claims.find((c) => c.kind === kind)?.id;
    const claimId = await submitClaim(client, profileId, kind, value, {
      origin: "assistant",
      claimToSupersede: activeSameKind,
    });
    await setClaimState(client, claimId, "confirmed");
    confirmed += 1;
  };

  await confirmClaim("role", { title: input.roleTitle });
  if (input.seniorityLevel !== null) {
    await confirmClaim("seniority", { level: input.seniorityLevel });
  }
  if (input.yearsExperience !== null) {
    await confirmClaim("years_experience", { years: input.yearsExperience });
  }
  await confirmClaim("summary", { text: input.summary });

  const existing = new Set(
    living.claims
      .filter((c) => c.kind === "skill")
      .map((c) =>
        String((c.value as { name?: unknown })?.name ?? "")
          .trim()
          .toLowerCase(),
      ),
  );
  for (const name of input.skills) {
    const key = name.trim().toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    await confirmClaim("skill", { name });
  }

  // Target métiers drive discovery — merged into the live preferences.
  const prefs = await loadPreferences(client, profileId);
  await savePreferences(client, profileId, {
    ...prefs,
    targetRoleFamilies: input.targetRoles,
  });

  return { confirmed };
}
