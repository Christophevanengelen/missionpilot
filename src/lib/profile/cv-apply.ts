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
    // Single-valued kinds go through the replace RPC, whose ATOMIC auto-close
    // supersedes the current active claim — passing an id read from our own
    // (potentially stale) snapshot would only add a failure path.
    const claimId = await submitClaim(client, profileId, kind, value, {
      origin: "assistant",
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

  // Existing skill claims by normalized name, WITH their state: a kept
  // selection must not silently no-op against a proposed/needs_review claim —
  // the review-screen validation IS the confirmation.
  const existing = new Map<string, { id: string; state: string }>();
  for (const c of living.claims) {
    if (c.kind !== "skill") continue;
    const key = String((c.value as { name?: unknown })?.name ?? "")
      .trim()
      .toLowerCase();
    if (key) existing.set(key, { id: c.id, state: c.state });
  }
  for (const name of input.skills) {
    const key = name.trim().toLowerCase();
    const prior = existing.get(key);
    if (prior) {
      if (prior.state === "proposed" || prior.state === "needs_review") {
        await setClaimState(client, prior.id, "confirmed");
        confirmed += 1;
      }
      // "confirmed" needs nothing; "rejected" is DELIBERATELY left untouched —
      // an explicit rejection is not silently overridden by a re-import (the
      // interview's restore flow exists for that).
      continue;
    }
    existing.set(key, { id: "new", state: "confirmed" });
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

/**
 * Add the skills the user kept selected on the CHIP screen (the fallback flow
 * without deep AI). Same honesty semantics as `applyCvProfile`: the explicit
 * per-chip selection IS the validation, so skills land CONFIRMED — which also
 * lets the auto-chained discovery search on them immediately. A kept selection
 * confirms an existing proposed/needs_review claim; confirmed claims need
 * nothing; rejected claims are DELIBERATELY untouched (an explicit rejection
 * is never silently overridden — the interview's restore flow exists for
 * that).
 */
export async function addCvSkills(
  client: Client,
  profileId: string,
  skills: string[],
): Promise<{ added: number }> {
  const living = await loadLivingProfile(client, profileId);
  const existing = new Map<string, { id: string; state: string }>();
  for (const c of living.claims) {
    if (c.kind !== "skill") continue;
    const key = String((c.value as { name?: unknown })?.name ?? "")
      .trim()
      .toLowerCase();
    if (key) existing.set(key, { id: c.id, state: c.state });
  }
  let added = 0;
  for (const name of skills) {
    const key = name.trim().toLowerCase();
    const prior = existing.get(key);
    if (prior) {
      if (prior.state === "proposed" || prior.state === "needs_review") {
        await setClaimState(client, prior.id, "confirmed");
        added += 1;
      }
      continue;
    }
    const claimId = await submitClaim(client, profileId, "skill", { name });
    await setClaimState(client, claimId, "confirmed");
    existing.set(key, { id: claimId, state: "confirmed" });
    added += 1;
  }
  return { added };
}
