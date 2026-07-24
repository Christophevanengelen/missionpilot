"use server";

/**
 * CV ingestion actions. `analyzeCvAction` reads an uploaded PDF (or pasted
 * text) and returns DETECTED skills — it stores nothing (privacy: the CV file
 * and text are never persisted). `addSkillsAction` creates the skills the user
 * confirms as proposed claims (the normal claim lifecycle then applies).
 */
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import * as profile from "./logic";
import {
  aiAnalyzeCvProfile,
  aiDetectSkills,
  type CvProfileUnderstanding,
} from "./cv-ai";
import { applyCvProfile, applyProfileSchema } from "./cv-apply";
import { detectSkills } from "./cv-extract";
import { CvPdfError, extractPdfText } from "./cv-pdf";

const logger = createLogger({ module: "cv-actions" });

export type CvAnalysis =
  | {
      ok: true;
      skills: string[];
      aiUsed: boolean;
      /** Deep AI understanding (null when AI is off or failed) — drives the
       *  one-screen "voici ce que j'ai compris" flow. */
      profile: CvProfileUnderstanding | null;
    }
  | { ok: false; error: "empty" | "pdf" | "generic" };

/**
 * Extract text from the uploaded PDF or pasted text, then understand it.
 * With AI configured, ONE deep analysis covers role/seniority/summary/core
 * skills/target métiers and the screen shows ONLY those curated core skills
 * (owner mandate: no keyword dumps). The deterministic taxonomy detector runs
 * ONLY in the fallback branch (AI off or failed), merged with the light AI
 * pass — an AI failure never breaks the flow, it degrades to the chip
 * experience.
 */
export async function analyzeCvAction(formData: FormData): Promise<CvAnalysis> {
  try {
    await verifySession();
    const file = formData.get("file");
    const pasted = formData.get("text");
    let text = "";
    if (file instanceof File && file.size > 0) {
      text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    } else if (typeof pasted === "string") {
      text = pasted;
    }
    if (!text.trim()) return { ok: false, error: "empty" };

    const aiProfile = await aiAnalyzeCvProfile(text);
    if (aiProfile) {
      // Owner mandate: NO keyword dump. The deep analysis already curates the
      // recurrence-weighted core skills — show exactly those.
      return {
        ok: true,
        skills: aiProfile.coreSkills,
        aiUsed: true,
        profile: aiProfile,
      };
    }
    // Fallback (AI off or failed): deterministic taxonomy + light AI pass.
    const deterministic = detectSkills(text);
    const aiSkills = await aiDetectSkills(text);
    const seen = new Set(deterministic.map((s) => s.toLowerCase()));
    const merged = [...deterministic];
    for (const skill of aiSkills ?? []) {
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(skill);
    }
    return {
      ok: true,
      skills: merged,
      aiUsed: aiSkills !== null,
      profile: null,
    };
  } catch (error) {
    logger.error("cv analyze failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof CvPdfError ? "pdf" : "generic",
    };
  }
}

const addSkillsSchema = z.object({
  // Upper bound covers the merged worst case by construction: the full
  // taxonomy (66) + the AI list (bounded at 60) — an "add all" on a
  // keyword-stuffed CV must always be submittable.
  skills: z.array(z.string().trim().min(1).max(120)).min(1).max(130),
});

export type AddSkillsResult =
  { ok: true; added: number } | { ok: false; error: string };

/** Create the confirmed-by-the-user skills as proposed claims, skipping ones
 *  the profile already has (case-insensitive). */
export async function addSkillsAction(
  input: unknown,
): Promise<AddSkillsResult> {
  try {
    const { skills } = addSkillsSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const own = await profile.getOwnProfile(client);
    const living = await profile.loadLivingProfile(client, own.id);
    const existing = new Set(
      living.claims
        .filter((c) => c.kind === "skill")
        .map((c) =>
          String((c.value as { name?: unknown })?.name ?? "")
            .trim()
            .toLowerCase(),
        ),
    );
    let added = 0;
    for (const name of skills) {
      const key = name.trim().toLowerCase();
      if (existing.has(key)) continue;
      await profile.submitClaim(client, own.id, "skill", { name });
      existing.add(key);
      added += 1;
    }
    return { ok: true, added };
  } catch (error) {
    logger.error("add skills failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}

export type ApplyCvProfileResult =
  { ok: true; confirmed: number } | { ok: false; error: string };

/**
 * Apply the WHOLE understood profile in one click (owner mandate: one fluid
 * validation, not chip-by-chip). Thin wrapper over the testable
 * `applyCvProfile` logic (see cv-apply.ts for the semantics).
 */
export async function applyCvProfileAction(
  input: unknown,
): Promise<ApplyCvProfileResult> {
  try {
    const parsed = applyProfileSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const own = await profile.getOwnProfile(client);
    const { confirmed } = await applyCvProfile(client, own.id, parsed);
    return { ok: true, confirmed };
  } catch (error) {
    logger.error("apply cv profile failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "generic" };
  }
}
