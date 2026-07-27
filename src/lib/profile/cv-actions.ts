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
import {
  buildCareerProfile,
  buildCareerProfileFromRecords,
} from "./linkedin-export";
import {
  LinkedInMdpError,
  recupererParcours,
  type RapportDomaine,
} from "./linkedin-mdp";
import { extractLinkedInFiles, LinkedInExportError } from "./linkedin-zip";

import {
  ecrireConsentementArt9,
  lireConsentementArt9,
} from "./consentement";

const logger = createLogger({ module: "cv-actions" });

/**
 * Consigne le consentement de l'art. 9, sans écraser une date existante.
 *
 * Un échec d'écriture n'interrompt PAS l'analyse : la personne vient de cocher
 * la case et d'appuyer sur le bouton, son consentement est réel. Perdre la trace
 * est un problème de preuve — le nôtre — et le journaliser est la bonne
 * réponse ; refuser le service au motif qu'on n'a pas su noter serait lui faire
 * payer notre panne.
 */
async function enregistrerConsentementArt9(): Promise<void> {
  try {
    const client = await createClient();
    const own = await profile.getOwnProfile(client);
    await ecrireConsentementArt9(client, own.id, true);
  } catch (error) {
    logger.error("art9 consent not recorded", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
  }
}

/** L'état du consentement, pour l'écran qui le montre et permet de le retirer. */
export async function lireMonConsentementArt9(): Promise<string | null> {
  await verifySession();
  const client = await createClient();
  const own = await profile.getOwnProfile(client);
  const date = await lireConsentementArt9(client, own.id);
  return date ? date.toISOString() : null;
}

/** Retirer son consentement — un droit (art. 7(3)), sans justification. */
export async function retirerConsentementArt9Action(): Promise<{
  ok: boolean;
}> {
  try {
    await verifySession();
    const client = await createClient();
    const own = await profile.getOwnProfile(client);
    await ecrireConsentementArt9(client, own.id, false);
    return { ok: true };
  } catch (error) {
    logger.error("art9 consent withdrawal failed", {
      reason: error instanceof Error ? error.constructor.name : "unknown",
    });
    return { ok: false };
  }
}

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
      /** Import par l'API LinkedIn uniquement : ce que chaque domaine a
       *  réellement rendu, et ce qui a été délibérément écarté. Les libellés
       *  renvoyés par LinkedIn ne sont documentés pour aucun domaine sauf
       *  PROFILE ; sans ce compte rendu, un import qui ne trouve rien ressemble
       *  trait pour trait à un import réussi. */
      rapportLinkedIn?: RapportDomaine[];
    }
  | {
      ok: false;
      /* `consent` : le consentement de l'art. 9 n'a pas été donné. C'est un
         REFUS DÉLIBÉRÉ, pas une panne — l'écran doit le dire autrement qu'une
         erreur, et surtout ne pas suggérer de réessayer. */
      error: "empty" | "pdf" | "linkedin" | "generic" | "consent";
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

    /* LE CONSENTEMENT SE DEMANDE AVANT LE DÉPÔT, ET SE VÉRIFIE ICI.
       Le vérifier côté client seulement en ferait une politesse : le texte du CV
       partirait chez le fournisseur d'IA dès qu'on appelle l'action autrement.
       On enregistre AVANT d'analyser, et on refuse si la case n'est pas cochée —
       un traitement de l'art. 9 sans exception de l'art. 9(2) est interdit, pas
       toléré. */
    if (formData.get("consentArt9") !== "on") {
      return { ok: false, error: "consent" };
    }
    await enregistrerConsentementArt9();

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

/**
 * Import du parcours par l'API LinkedIn (Member Data Portability), avec le
 * jeton que la personne a généré elle-même dans le portail développeur.
 *
 * Le jeton traverse cette fonction et n'en ressort pas : il n'est ni stocké,
 * ni journalisé, ni renvoyé au client. C'est la contrepartie exigée par la
 * promesse « rien n'est gardé sauf le profil » — la même règle que le fichier
 * CV, qui n'est jamais conservé non plus.
 *
 * Le pipeline d'aval est rigoureusement celui de l'archive : mêmes règles
 * d'honnêteté, même validation par la personne, même découverte ensuite.
 */
export async function analyzeLinkedInApiAction(
  formData: FormData,
): Promise<CvAnalysis> {
  try {
    await verifySession();
    const jeton = formData.get("token");
    if (typeof jeton !== "string" || jeton.trim() === "") {
      return { ok: false, error: "empty" };
    }
    const { records, rapport } = await recupererParcours(jeton);
    const { text, skills } = buildCareerProfileFromRecords(records);
    const analyse = await analyzeText(text, skills);
    return analyse.ok ? { ...analyse, rapportLinkedIn: rapport } : analyse;
  } catch (error) {
    // `error.message` de LinkedInMdpError est rédigé pour être lu par la
    // personne et ne contient jamais le jeton — voir linkedin-mdp.ts.
    logger.error("linkedin api import failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof LinkedInMdpError ? "linkedin" : "generic",
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
