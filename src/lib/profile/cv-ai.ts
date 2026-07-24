import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/registry";
import { createLogger } from "@/lib/observability/logger";

/**
 * AI-assisted CV skill reading (first real LLM use case — owner-approved,
 * OpenAI account). Complements the deterministic taxonomy detector: the model
 * can read free-form skills the curated list misses. The CV text is DATA (the
 * provider enforces the prompt-injection boundary + strict envelope), and the
 * result is still only a PROPOSAL list the user confirms chip by chip.
 *
 * Graceful degradation: when the OpenAI provider is not configured
 * (AI_DEFAULT_PROVIDER !== "openai" or no key), this returns `null` and the
 * deterministic detector stands alone — no error, no cost.
 */

const CV_SKILLS_PROMPT_VERSION = "cv-skills-1";
const MAX_CV_CHARS = 30_000; // cost bound — a CV fits well within this.

const aiSkillsSchema = z
  .object({
    skills: z.array(z.string().trim().min(1).max(120)).max(60),
  })
  .strict();

const log = createLogger({ module: "cv-ai" });

export function aiCvConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/**
 * Skills the model reads from the CV text, or `null` when AI is not
 * configured or the call fails (the deterministic result stands alone —
 * an AI failure must never break the import).
 */
export async function aiDetectSkills(text: string): Promise<string[] | null> {
  if (!aiCvConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "cv-skill-extraction",
      promptVersion: CV_SKILLS_PROMPT_VERSION,
      input: {
        instruction:
          "Extract the professional skills, tools and technologies this CV explicitly mentions. Return each as a short canonical name (e.g. 'React', 'Product Management'). Only skills present in the text — never infer or invent.",
        cvText: text.slice(0, MAX_CV_CHARS),
      },
      dataSchema: aiSkillsSchema,
    });
    if (response.envelope.status === "failed") return null;
    // Bound + de-duplicate defensively (the user still confirms every chip).
    const seen = new Set<string>();
    const skills: string[] = [];
    for (const raw of response.envelope.data.skills) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      skills.push(name);
    }
    return skills;
  } catch (error) {
    // Typed, content-free logging; the import continues deterministically.
    log.warn("ai skill detection unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
}
