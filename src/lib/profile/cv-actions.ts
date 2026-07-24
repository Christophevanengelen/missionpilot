"use server";

/**
 * CV / LinkedIn ingestion actions. `analyzeCvAction` reads an uploaded PDF (or
 * pasted text); `analyzeLinkedInAction` reads an uploaded LinkedIn OFFICIAL
 * data-export ZIP. Both feed the SAME understanding pipeline and store nothing
 * (privacy: the file and text are never persisted). `addSkillsAction` saves
 * the skills the user kept selected as CONFIRMED claims (the chip selection is
 * the validation).
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
import { addCvSkills, applyCvProfile, applyProfileSchema } from "./cv-apply";
import { detectSkills } from "./cv-extract";
import { CvPdfError, extractPdf } from "./cv-pdf";
import { lintCvForAts, type AtsFinding } from "./cv-ats-lint";
import { buildCareerProfile } from "./linkedin-export";
import { extractLinkedInFiles, LinkedInExportError } from "./linkedin-zip";

const logger = createLogger({ module: "cv-actions" });

export type CvAnalysis =
  | {
      ok: true;
      skills: string[];
      aiUsed: boolean;
      /** Deep AI understanding (null when AI is off or failed) — drives the
       *  one-screen "voici ce que j'ai compris" flow. */
      profile: CvProfileUnderstanding | null;
      /** Deterministic ATS parse-safety findings on the uploaded PDF (empty
       *  for pasted text / LinkedIn imports, which have no file layout). */
      atsFindings: AtsFinding[];
    }
  | {
      ok: false;
      error: "empty" | "pdf" | "linkedin" | "generic";
      /** Carried on the ERROR path too: a scanned-image PDF extracts no text
       *  (⇒ error "empty") but is exactly when the no_extractable_text finding
       *  matters most — it must still reach the user. */
      atsFindings?: AtsFinding[];
    };

/**
 * Understand a career narrative — from a CV or a LinkedIn export, uniformly.
 * With AI configured, ONE deep analysis covers role/seniority/summary/core
 * skills/target métiers and the screen shows ONLY those curated core skills
 * (owner mandate: no keyword dumps). The deterministic taxonomy detector runs
 * ONLY in the fallback branch (AI off or failed), merged with the light AI
 * pass and any explicitly declared skills — an AI failure never breaks the
 * flow, it degrades to the chip experience. `declaredSkills` (e.g. LinkedIn's
 * Skills.csv) are surfaced even when the taxonomy does not know them.
 */
async function analyzeText(
  text: string,
  declaredSkills: string[] = [],
  atsFindings: AtsFinding[] = [],
): Promise<CvAnalysis> {
  // A scanned/image PDF extracts (near-)no text — carry the ATS findings so
  // the "likely a scanned image" guidance reaches the user instead of a bare
  // "document looks empty".
  if (!text.trim()) return { ok: false, error: "empty", atsFindings };

  const aiProfile = await aiAnalyzeCvProfile(text);
  if (aiProfile) {
    // Owner mandate: NO keyword dump. The deep analysis already curates the
    // recurrence-weighted core skills — show exactly those.
    return {
      ok: true,
      skills: aiProfile.coreSkills,
      aiUsed: true,
      profile: aiProfile,
      atsFindings,
    };
  }
  // Fallback (AI off or failed): deterministic taxonomy + light AI pass +
  // explicitly declared skills.
  const deterministic = detectSkills(text);
  const aiSkills = await aiDetectSkills(text);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const skill of [
    ...deterministic,
    ...(aiSkills ?? []),
    ...declaredSkills,
  ]) {
    const key = skill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(skill.trim());
  }
  return {
    ok: true,
    skills: merged,
    aiUsed: aiSkills !== null,
    profile: null,
    atsFindings,
  };
}

/** Analyse an uploaded CV (PDF) or pasted CV text. A PDF also gets a
 *  deterministic ATS parse-safety lint (pasted text has no file layout). */
export async function analyzeCvAction(formData: FormData): Promise<CvAnalysis> {
  try {
    await verifySession();
    const file = formData.get("file");
    const pasted = formData.get("text");
    let text = "";
    let atsFindings: AtsFinding[] = [];
    if (file instanceof File && file.size > 0) {
      const extracted = await extractPdf(
        new Uint8Array(await file.arrayBuffer()),
      );
      text = extracted.text;
      atsFindings = lintCvForAts(extracted);
    } else if (typeof pasted === "string") {
      text = pasted;
    }
    return await analyzeText(text, [], atsFindings);
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

/**
 * Analyse an uploaded LinkedIn OFFICIAL data-export ZIP (never scraping — the
 * user downloads their own archive from LinkedIn and uploads it). The archive
 * is unzipped in memory (bounded), the relevant CSVs are turned into a career
 * narrative, and the SAME understanding pipeline runs.
 */
export async function analyzeLinkedInAction(
  formData: FormData,
): Promise<CvAnalysis> {
  try {
    await verifySession();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "empty" };
    }
    const files = extractLinkedInFiles(
      new Uint8Array(await file.arrayBuffer()),
    );
    const { text, skills } = buildCareerProfile(files);
    return await analyzeText(text, skills);
  } catch (error) {
    logger.error("linkedin analyze failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof LinkedInExportError ? "linkedin" : "generic",
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

/** Thin wrapper over the testable `addCvSkills` logic (see cv-apply.ts):
 *  the chip selection is the user's validation, so skills land CONFIRMED. */
export async function addSkillsAction(
  input: unknown,
): Promise<AddSkillsResult> {
  try {
    const { skills } = addSkillsSchema.parse(input);
    await verifySession();
    const client = await createClient();
    const own = await profile.getOwnProfile(client);
    const { added } = await addCvSkills(client, own.id, skills);
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
