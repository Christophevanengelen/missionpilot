/**
 * Testable logic behind the AI "pourquoi ce match" insights: the compact
 * profile dossier, the freshness fingerprint, the cost-bounded target picker
 * and the RLS-scoped persistence. No "use server" here — the action stays a
 * thin orchestrator and integration tests exercise the exact production
 * logic through a real session client.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { MatchInsight } from "./ai-insight";
import type { EligibilityGate } from "./hard-constraints";

type Client = SupabaseClient<Database>;

/** Cost bound: at most this many LLM judgements per analysis run. */
export const MAX_INSIGHTS_PER_RUN = 10;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

/**
 * The compact, factual profile text the model judges against — CONFIRMED
 * claims only (an unconfirmed proposal must not influence a judgement shown
 * as "your" match) plus the validated target métiers. Empty string when the
 * profile has nothing confirmed yet.
 */
export function buildProfileDossier(
  claims: { kind: string; state: string; value: unknown }[],
  preferences: { targetRoleFamilies: string[] },
  /**
   * Answers the person gave to questions the career reading could not settle
   * from the CV alone — team sizes, budgets, scope.
   *
   * Threading these through is what closes the loop rather than decorating it:
   * the reading returns `unknown` precisely because a CV lists titles without
   * scope, so an answer that never reaches the dossier leaves the next reading
   * exactly as blind as the last one, and the question comes back forever.
   */
  clarifications: readonly { question: string; answer: string }[] = [],
): string {
  const confirmed = claims.filter((c) => c.state === "confirmed");
  // No confirmed claims ⇒ no dossier AT ALL (target métiers are preferences,
  // not profile facts — judging "your match" on them alone would fabricate a
  // profile the user never confirmed; the action refuses with no_profile).
  if (confirmed.length === 0) return "";
  const first = (kind: string, key: string): string | null => {
    const v = confirmed
      .filter((c) => c.kind === kind)
      .map((c) => (c.value as Record<string, unknown>)?.[key])
      .find((x) => typeof x === "string" || typeof x === "number");
    return v === undefined ? null : String(v);
  };
  const role = first("role", "title");
  const seniority = first("seniority", "level");
  const years = first("years_experience", "years");
  const summary = first("summary", "text");
  const skills = confirmed
    .filter((c) => c.kind === "skill")
    .map((c) => (c.value as { name?: unknown })?.name)
    .filter((n): n is string => typeof n === "string" && n.trim() !== "");
  const targets = preferences.targetRoleFamilies.filter((t) => t.trim() !== "");

  const answered = clarifications
    .map((c) => ({ question: c.question.trim(), answer: c.answer.trim() }))
    .filter((c) => c.question !== "" && c.answer !== "");

  const lines = [
    role
      ? `Rôle: ${role}${seniority ? ` (${seniority})` : ""}${years ? ` — ${years} ans d'expérience` : ""}`
      : null,
    summary ? `Résumé: ${summary}` : null,
    skills.length > 0 ? `Compétences confirmées: ${skills.join(", ")}` : null,
    targets.length > 0 ? `Métiers cibles: ${targets.join(", ")}` : null,
    // Labelled as DECLARED, and kept in the person's own words. The model must
    // be able to tell what was read from a document apart from what someone
    // told us directly — they carry different weight, and flattening the two
    // would let a spoken claim be quoted back as if a CV had evidenced it.
    answered.length > 0
      ? [
          "Précisions données par la personne (déclaratif) :",
          ...answered.map((c) => `- ${c.question} → ${c.answer}`),
        ].join("\n")
      : null,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

/** The ad text the model judges — normalized fields, deterministic order. */
export function buildOfferText(o: {
  title: string | null;
  organization: string | null;
  description: string | null;
  skills: string[] | null;
  requirements: string[] | null;
}): string {
  return [
    o.title,
    o.organization ? `chez ${o.organization}` : null,
    o.description,
    o.skills?.length ? `Compétences demandées: ${o.skills.join(", ")}` : null,
    o.requirements?.length ? `Exigences: ${o.requirements.join("; ")}` : null,
  ]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join("\n");
}

/** Freshness fingerprint of the exact (dossier, offer) pair — hex sha256,
 *  matching the DB's 64-char input_hash contract. */
export function insightInputHash(dossier: string, offerText: string): string {
  return createHash("sha256")
    .update(dossier)
    .update("\x00") // NUL separator: unambiguous (Postgres text cannot contain NUL); keep the ESCAPE, never a raw byte
    .update(offerText)
    .digest("hex");
}

export type InsightTarget = {
  opportunityId: string;
  offerText: string;
  inputHash: string;
};

/**
 * The cost-bounded work list: best-ranked NON-EXCLUDED opportunities first
 * (judging an offer the hard constraints already excluded would spend money
 * to contradict the user's own rules), skipping offers whose stored insight
 * is still fresh (same input hash) and offers with no text to judge.
 */
export function pickInsightTargets(
  ranked: {
    id: string;
    gate: EligibilityGate;
    offerText: string;
  }[],
  freshHashes: Map<string, string>,
  dossier: string,
  limit: number = MAX_INSIGHTS_PER_RUN,
): InsightTarget[] {
  const targets: InsightTarget[] = [];
  for (const r of ranked) {
    if (targets.length >= limit) break;
    if (r.gate === "excluded" || r.offerText.trim() === "") continue;
    const inputHash = insightInputHash(dossier, r.offerText);
    if (freshHashes.get(r.id) === inputHash) continue;
    targets.push({ opportunityId: r.id, offerText: r.offerText, inputHash });
  }
  return targets;
}

export type StoredInsight = {
  opportunity_id: string;
  fit: string;
  rationale: string;
  strengths: string[];
  gaps: string[];
  needs_review: boolean;
  input_hash: string;
};

/** All live insights of the profile, keyed by opportunity id (RLS: own). */
export async function loadInsights(
  client: Client,
  profileId: string,
): Promise<Map<string, StoredInsight>> {
  const { data, error } = await client
    .from("ai_match_insights")
    .select(
      "opportunity_id, fit, rationale, strengths, gaps, needs_review, input_hash",
    )
    .eq("profile_id", profileId);
  if (error) fail("insights list", error.message);
  const map = new Map<string, StoredInsight>();
  for (const row of data) {
    map.set(row.opportunity_id, {
      ...row,
      strengths: (row.strengths as string[]) ?? [],
      gaps: (row.gaps as string[]) ?? [],
    });
  }
  return map;
}

/** True when the stored insight already covers this exact (dossier, offer)
 *  pair — re-checked right before each LLM call so two overlapping runs
 *  (auto-chain + button) shrink their double-spend window to near zero. */
export async function isInsightFresh(
  client: Client,
  profileId: string,
  opportunityId: string,
  inputHash: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("ai_match_insights")
    .select("input_hash")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("insight freshness", error.message);
  return data?.input_hash === inputHash;
}

/** Store/refresh the ONE live insight of the opportunity (upsert on the
 *  unique pair — a refresh replaces, never stacks). */
export async function upsertInsight(
  client: Client,
  profileId: string,
  opportunityId: string,
  insight: MatchInsight,
  inputHash: string,
): Promise<void> {
  const { error } = await client.from("ai_match_insights").upsert(
    {
      profile_id: profileId,
      opportunity_id: opportunityId,
      fit: insight.fit,
      rationale: insight.rationale,
      strengths: insight.strengths,
      gaps: insight.gaps,
      needs_review: insight.needsReview,
      model: insight.model,
      prompt_version: insight.promptVersion,
      input_hash: inputHash,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("insight upsert", error.message);
}
