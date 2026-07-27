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

const CV_SKILLS_PROMPT_VERSION = "cv-skills-2";
const CV_PROFILE_PROMPT_VERSION = "cv-profile-2";
const MAX_CV_CHARS = 30_000; // cost bound — a CV fits well within this.

/**
 * L'instruction qui protège les données de l'article 9.
 *
 * Un CV mentionne souvent, sans que son auteur y ait pensé, une interruption de
 * carrière pour raison de santé, un mandat syndical, un engagement confessionnel
 * ou politique, une nationalité. Ce sont des données que le RGPD interdit de
 * traiter par principe.
 *
 * Cette phrase est LA mesure technique. Une case de consentement sans elle
 * serait une décharge, pas une protection : on ferait signer quelqu'un pour un
 * risque qu'on ne réduit pas. Elle voyage du côté SERVEUR de l'instruction, donc
 * hors de portée du texte du CV — un document ne peut pas la contredire.
 *
 * Ce qu'elle ne fait pas : garantir. Un modèle n'obéit pas comme une clause
 * `where`. Le résumé reste une zone de texte libre, et une mention qui y
 * survivrait entrerait dans le dossier professionnel, donc dans le tri. C'est
 * pourquoi la copie de l'écran de dépôt recommande toujours de retirer ces
 * mentions du CV : la meilleure protection reste celle qui ne dépend pas de
 * nous. Les deux versions de prompt sont incrémentées pour que les traces
 * distinguent l'avant de l'après.
 */
export const CONSIGNE_ART9 =
  " N'EXTRAIS ET NE REFORMULE JAMAIS les informations suivantes, même si le CV" +
  " les mentionne explicitement : état de santé, handicap, grossesse, origine" +
  " raciale ou ethnique, nationalité, opinions politiques, convictions" +
  " religieuses ou philosophiques, appartenance syndicale, vie sexuelle ou" +
  " orientation sexuelle, données biométriques ou génétiques, condamnations" +
  " pénales. Si une expérience est décrite par l'une de ces informations," +
  " retiens uniquement sa dimension professionnelle. Si une interruption de" +
  " carrière est mentionnée, n'en donne jamais le motif.";

const aiSkillsSchema = z
  .object({
    skills: z.array(z.string().trim().min(1).max(120)).max(60),
  })
  .strict();

/**
 * Deep CV understanding (owner mandate: "le système doit savoir quel rôle je
 * veux présenter en priorité — c'est de la logique sur base de mes
 * expériences"). All fields REQUIRED (nullable, never optional) per the
 * strict-structured-outputs dataSchema contract; length bounds are enforced
 * by this local gate only (stripped from the wire schema).
 */
const cvProfileSchema = z
  .object({
    /** The ONE professional role this CV most credibly presents. */
    roleTitle: z.string().trim().min(1).max(200),
    /** Short user-facing justification, grounded in the experiences. */
    roleRationale: z.string().trim().min(1).max(500),
    seniorityLevel: z.string().trim().min(1).max(100).nullable(),
    yearsExperience: z.number().int().min(0).max(80).nullable(),
    /** 2-3 sentence professional summary, first person, factual. */
    summary: z.string().trim().min(1).max(2000),
    /** Core skills ONLY — recurrent/recent across experiences, most important
     *  first. Not an exhaustive keyword dump. */
    coreSkills: z.array(z.string().trim().min(1).max(120)).min(1).max(15),
    /** 1-3 job-market métiers to search offers for, priority first. */
    targetRoles: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  })
  .strict();

export type CvProfileAnalysis = z.infer<typeof cvProfileSchema>;

/** The analysis plus the model's own uncertainty signal — a `needs_review`
 *  envelope must stay visible on a path that ends in CONFIRMED claims. */
export type CvProfileUnderstanding = CvProfileAnalysis & {
  needsReview: boolean;
};

const log = createLogger({ module: "cv-ai" });

export function aiCvConfigured(): boolean {
  return env.AI_DEFAULT_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/**
 * Deep profile analysis of the CV, or `null` when AI is not configured or the
 * call fails (the deterministic chip flow stands alone — an AI failure must
 * never break the import). One call covers everything: priority role +
 * rationale, seniority, years, summary, weighted core skills, target métiers.
 */
export async function aiAnalyzeCvProfile(
  text: string,
): Promise<CvProfileUnderstanding | null> {
  if (!aiCvConfigured()) return null;
  try {
    const provider = getAiProvider();
    const response = await provider.generateStructured({
      taskName: "cv-profile-analysis",
      promptVersion: CV_PROFILE_PROMPT_VERSION,
      // Server-authored instruction on the TRUSTED side; the input carries
      // only the untrusted CV text.
      taskInstruction:
        "Analyse le CV fourni dans inputData.cvText en profondeur comme un expert du recrutement. Déduis: (1) roleTitle — LE rôle professionnel que ce parcours présente le plus crédiblement en priorité (logique des expériences: récence, durée, progression); (2) roleRationale — 1-2 phrases en français justifiant ce choix à partir des expériences; (3) seniorityLevel (ex. Senior, Lead, Directeur) ou null si indécidable; (4) yearsExperience — années d'expérience pertinentes, ou null; (5) summary — résumé professionnel de 2-3 phrases en français, factuel, première personne; (6) coreSkills — UNIQUEMENT les compétences cœur, récurrentes et récentes à travers les expériences, la plus importante d'abord, max 15 — PAS une liste exhaustive de mots-clés; (7) targetRoles — 1 à 3 intitulés de métiers du marché de l'emploi à rechercher pour ce profil, prioritaire d'abord. N'invente RIEN qui ne soit pas dans le CV." +
        CONSIGNE_ART9,
      input: { cvText: text.slice(0, MAX_CV_CHARS) },
      dataSchema: cvProfileSchema,
    });
    if (response.envelope.status === "failed") return null;
    return {
      ...response.envelope.data,
      needsReview: response.envelope.status === "needs_review",
    };
  } catch (error) {
    log.warn("ai profile analysis unavailable", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    return null;
  }
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
      taskInstruction:
        "Extract the professional skills, tools and technologies the CV in inputData.cvText explicitly mentions. Return each as a short canonical name (e.g. 'React', 'Product Management'). Only skills present in the text — never infer or invent." +
        CONSIGNE_ART9,
      input: { cvText: text.slice(0, MAX_CV_CHARS) },
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
