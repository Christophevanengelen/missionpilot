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
import { detectSkills } from "./cv-extract";
import { CvPdfError, extractPdfText } from "./cv-pdf";

const logger = createLogger({ module: "cv-actions" });

export type CvAnalysis =
  | { ok: true; skills: string[] }
  | { ok: false; error: "empty" | "pdf" | "generic" };

/** Extract text from the uploaded PDF or pasted text, then detect skills. */
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
    return { ok: true, skills: detectSkills(text) };
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
  skills: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
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
