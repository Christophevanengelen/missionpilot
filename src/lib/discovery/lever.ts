import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { createTtlCache } from "./cache";
import { activeLeverBoards, type LeverBoard } from "./lever-boards";

/**
 * Connecteur Lever — et la source qui a demandé le plus de retenue.
 *
 * Même forme juridique que Greenhouse et Ashby : une API de tableau d'offres
 * publiée pour être lue par des tiers, sur laquelle l'employeur a choisi de
 * publier. Elle apporte du marché intermédiaire français et européen, là où
 * les deux autres penchent vers les grandes sociétés américaines.
 *
 * LE PIÈGE DE CETTE SOURCE, constaté en appelant neuf tableaux le 2026-08-02 :
 * `categories.commitment` ressemble à un champ structuré et n'en est pas un.
 * C'est du TEXTE LIBRE saisi par chaque employeur. Relevé tel quel :
 *
 *   « Permanent », « Full-time », « Full Time Contractor », « Short Term »,
 *   « Fixed-Term », « Internship », « Apprenticeship », « Scholarship »,
 *   « Permanent - Part-time », « FR Executive/Cadre », « BE Employee »,
 *   « NL Permanent employee », « Permanent Full Time Employee »…
 *
 * Ashby rend une énumération fermée ; Lever rend ce que le recruteur a tapé.
 * La tentation serait d'écrire un rapprochement approximatif qui range tout.
 * On ne le fait pas : ce champ dit ce que la personne lit EN PREMIER, et une
 * mission annoncée comme un poste permanent est un mensonge coûteux.
 *
 * LA RÈGLE RETENUE : on ne traduit que sur un MOT EXPLICITE. « Contractor »
 * dit freelance. « Part-time » dit temps partiel. « Permanent » dit permanent.
 * « Full-time » ne dit rien de l'engagement — c'est une durée hebdomadaire,
 * pas un type de contrat — et reste donc vide, conformément au contrat du
 * champ : « the engagement the source EXPLICITLY states, else null ». Tout le
 * reste est journalisé pour être cartographié EXPRÈS, jamais deviné ici.
 */

const TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const MAX_CONCURRENT_BOARDS = 6;

const USER_AGENT =
  "MissionPilot/1.0 (+https://missionpilot.net; open source job search)";

export const LIMITES_LATENCE = {
  TIMEOUT_MS,
  MAX_CONCURRENT_BOARDS,
} as const;

export class LeverError extends Error {}

const log = createLogger({ module: "discovery-lever" });

const resultCache = createTtlCache<DiscoveredAd[]>(CACHE_TTL_MS);
const failureCache = createTtlCache<true>(FAILURE_TTL_MS);

export function leverConfigured(): boolean {
  return env.LEVER_ENABLED === true && activeLeverBoards().length > 0;
}

const postingSchema = z.object({
  text: z.string().nullish(),
  hostedUrl: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  country: z.string().nullish(),
  createdAt: z.number().nullish(),
  categories: z
    .object({
      commitment: z.string().nullish(),
      location: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
    })
    .nullish(),
});

/** La réponse est un TABLEAU nu, pas une enveloppe. */
const responseSchema = z.array(postingSchema);

/**
 * L'ORDRE DES RÈGLES EST LE CŒUR DE LA FONCTION, et il est délibéré.
 *
 * Un même libellé peut porter deux mots : « Permanent - Part-time ». Le plus
 * SPÉCIFIQUE gagne, parce que c'est celui qui informe — savoir qu'un poste est
 * à temps partiel change une décision, savoir qu'il est permanent la change
 * moins. D'où : contrat d'abord, temps partiel ensuite, durée déterminée,
 * permanent en dernier.
 */
function versEngagement(brut: string | null | undefined): {
  type: DiscoveredAd["engagementType"];
  inconnu: string | null;
} {
  if (!brut) return { type: null, inconnu: null };
  const t = brut.toLowerCase();

  if (t.includes("contractor") || t.includes("contract"))
    return { type: "freelance", inconnu: null };
  if (t.includes("part-time") || t.includes("part time"))
    return { type: "part_time", inconnu: null };
  if (
    t.includes("temporary") ||
    t.includes("short term") ||
    t.includes("short-term") ||
    t.includes("fixed-term") ||
    t.includes("fixed term") ||
    t.includes("interim")
  )
    return { type: "interim", inconnu: null };
  if (t.includes("permanent")) return { type: "permanent", inconnu: null };

  // Connus, volontairement NON traduits : un stage, une alternance ou une
  // bourse ne sont aucun des quatre types du domaine. Les journaliser
  // n'apprendrait rien — on sait déjà qu'ils n'ont pas d'équivalent.
  if (
    t.includes("intern") ||
    t.includes("apprentice") ||
    t.includes("scholarship") ||
    t.includes("alternance") ||
    t.includes("stage")
  )
    return { type: null, inconnu: null };

  // « Full-time », « FR Executive/Cadre », « BE Employee »… : ces libellés ne
  // disent rien d'EXPLICITE sur l'engagement. Vide, et signalé.
  return { type: null, inconnu: brut };
}

function toAd(
  posting: z.infer<typeof postingSchema>,
  board: LeverBoard,
): DiscoveredAd {
  const cat = posting.categories ?? {};
  const lieux = [...(cat.allLocations ?? []), cat.location, posting.country]
    .map((l) => l?.trim())
    .filter((l): l is string => Boolean(l));

  const { type, inconnu } = versEngagement(cat.commitment);
  if (inconnu !== null) {
    log.info("engagement lever non cartographié", {
      board: board.jeton,
      code: inconnu,
    });
  }

  const description = posting.descriptionPlain?.trim() || null;
  return {
    title: posting.text?.trim() || null,
    // Lever ne renvoie aucun nom d'entreprise : il vient de la liste curée.
    organization: board.nom,
    description,
    locationText: lieux.length > 0 ? [...new Set(lieux)].join(" · ") : null,
    sourceUrl: posting.hostedUrl?.trim() || null,
    engagementType: type,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    // `createdAt` est en millisecondes epoch. Une valeur non finie donnerait
    // une date invalide affichée comme fraîche : on rend `null`.
    postedAt:
      typeof posting.createdAt === "number" &&
      Number.isFinite(posting.createdAt)
        ? new Date(posting.createdAt).toISOString()
        : null,
    rawText: description ?? posting.text?.trim() ?? "",
  };
}

async function fetchBoard(board: LeverBoard): Promise<DiscoveredAd[]> {
  const cached = resultCache.get(board.jeton);
  if (cached) return cached;
  if (failureCache.get(board.jeton)) return [];

  const url = `https://api.lever.co/v0/postings/${board.jeton}?mode=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new LeverError(`lever ${board.jeton}: HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new LeverError(`lever ${board.jeton}: unexpected payload`);
    }
    const ads: DiscoveredAd[] = [];
    for (const posting of parsed.data) {
      const ad = toAd(posting, board);
      if (ad.title === null && ad.sourceUrl === null) continue;
      ads.push(ad);
    }
    resultCache.set(board.jeton, ads);
    return ads;
  } finally {
    clearTimeout(timer);
  }
}

/** Interroge chaque tableau curé. Les mots-clés ne sont pas envoyés : l'API
 *  n'expose aucun filtre, d'où `ignoresKeywords` côté registre. */
export async function searchLever(): Promise<DiscoveredAd[]> {
  const boards = activeLeverBoards();
  const ads: DiscoveredAd[] = [];
  for (let i = 0; i < boards.length; i += MAX_CONCURRENT_BOARDS) {
    const lot = boards.slice(i, i + MAX_CONCURRENT_BOARDS);
    const regles = await Promise.allSettled(lot.map(fetchBoard));
    regles.forEach((r, j) => {
      if (r.status === "fulfilled") {
        ads.push(...r.value);
        return;
      }
      failureCache.set(lot[j].jeton, true);
      log.warn("tableau lever injoignable", { board: lot[j].jeton });
    });
  }
  return ads;
}
