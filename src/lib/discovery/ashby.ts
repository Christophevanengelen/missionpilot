import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { activeAshbyBoards, type AshbyBoard } from "./ashby-boards";
import { createTtlCache } from "./cache";
import { toPostedAt } from "./posted-at";

/**
 * Connecteur Ashby — la source qui sait dire « contrat ».
 *
 * Même forme juridique que Greenhouse et Recruitee : `posting-api` est publiée
 * par Ashby pour que ses clients affichent leur tableau ailleurs que sur leur
 * site, et répond sans clé parce qu'elle est faite pour être lue par des
 * tiers.
 *
 * CE QU'ELLE APPORTE QUE GREENHOUSE N'A PAS : `employmentType`. Distinguer une
 * mission d'un poste salarié est le cœur de ce produit, et c'est le seul champ
 * de toutes les sources ATS qui le DISE au lieu de le laisser deviner.
 *
 * UN TYPE INCONNU N'EST PAS TRADUIT AU JUGÉ. Ashby peut ajouter une valeur
 * demain ; on la journalise et on laisse le champ vide, plutôt que de la
 * rabattre sur « permanent » parce que c'est le cas le plus fréquent. Un
 * `Intern` affiché comme un poste permanent serait un mensonge sur la seule
 * chose que la personne regarde en premier.
 *
 * LA RÉMUNÉRATION RESTE VIDE, et c'est constaté, pas supposé : le bloc
 * `compensation` existe mais revient sans montant sur les tableaux curés — les
 * employeurs ne le remplissent pas. Extraire un chiffre du texte de l'annonce
 * donnerait une fourchette inventée, et on décide dessus.
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

export class AshbyError extends Error {}

const log = createLogger({ module: "discovery-ashby" });

const resultCache = createTtlCache<DiscoveredAd[]>(CACHE_TTL_MS);
const failureCache = createTtlCache<true>(FAILURE_TTL_MS);

/** Une ligne par type inconnu et par tableau, pas par offre — même raison que
 *  dans `lever.ts` : un journal qui se répète cent fois ne se lit plus. */
const dejaSignale = new Set<string>();

export function ashbyConfigured(): boolean {
  return env.ASHBY_ENABLED === true && activeAshbyBoards().length > 0;
}

const jobSchema = z.object({
  title: z.string().nullish(),
  jobUrl: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  location: z.string().nullish(),
  secondaryLocations: z
    .array(z.object({ location: z.string().nullish() }))
    .nullish(),
  employmentType: z.string().nullish(),
  publishedAt: z.string().nullish(),
  isListed: z.boolean().nullish(),
});

const responseSchema = z.object({ jobs: z.array(jobSchema) });

/**
 * Le vocabulaire d'Ashby vers celui du domaine.
 *
 * `Intern` n'a PAS d'équivalent : un stage n'est ni freelance, ni temps
 * partiel, ni intérim, ni permanent. Il rend `null` — le produit dira « non
 * précisé », ce qui est vrai, plutôt que de le ranger de force.
 */
const ENGAGEMENTS: Record<string, DiscoveredAd["engagementType"]> = {
  fulltime: "permanent",
  parttime: "part_time",
  contract: "freelance",
  temporary: "interim",
  intern: null,
};

function versEngagement(brut: string | null | undefined): {
  type: DiscoveredAd["engagementType"];
  inconnu: string | null;
} {
  if (!brut) return { type: null, inconnu: null };
  const cle = brut
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (cle in ENGAGEMENTS) return { type: ENGAGEMENTS[cle], inconnu: null };
  return { type: null, inconnu: brut };
}

function toAd(job: z.infer<typeof jobSchema>, board: AshbyBoard): DiscoveredAd {
  const lieux = [
    job.location,
    ...(job.secondaryLocations ?? []).map((l) => l.location),
  ]
    .map((l) => l?.trim())
    .filter((l): l is string => Boolean(l));

  const { type, inconnu } = versEngagement(job.employmentType);
  if (inconnu !== null) {
    // Journalisé pour qu'un nouveau type soit cartographié EXPRÈS, au lieu
    // d'être deviné ici par le prochain qui passe — une fois par type.
    const cle = `${board.jeton}:${inconnu}`;
    if (!dejaSignale.has(cle)) {
      dejaSignale.add(cle);
      log.info("type d'engagement ashby non cartographié", {
        board: board.jeton,
        code: inconnu,
      });
    }
  }

  const description = job.descriptionPlain?.trim() || null;
  return {
    title: job.title?.trim() || null,
    // Ashby ne renvoie aucun nom d'entreprise : le nom vient de la liste curée.
    organization: board.nom,
    description,
    // Les lieux secondaires comptent : « Paris » d'abord et « Remote (Europe) »
    // ensuite, c'est la même offre et la seconde ligne est souvent celle qui
    // rend la personne éligible.
    locationText: lieux.length > 0 ? lieux.join(" · ") : null,
    sourceUrl: job.jobUrl?.trim() || null,
    engagementType: type,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    postedAt: toPostedAt(job.publishedAt ?? null),
    rawText: description ?? job.title?.trim() ?? "",
  };
}

async function fetchBoard(board: AshbyBoard): Promise<DiscoveredAd[]> {
  const cached = resultCache.get(board.jeton);
  if (cached) return cached;
  if (failureCache.get(board.jeton)) return [];

  const url = `https://api.ashbyhq.com/posting-api/job-board/${board.jeton}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AshbyError(`ashby ${board.jeton}: HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AshbyError(`ashby ${board.jeton}: unexpected payload`);
    }
    const ads: DiscoveredAd[] = [];
    for (const job of parsed.data.jobs) {
      // `isListed: false` = l'employeur a retiré l'annonce de son tableau
      // public tout en la gardant accessible par lien direct. La relayer irait
      // contre sa décision.
      if (job.isListed === false) continue;
      const ad = toAd(job, board);
      if (ad.title === null && ad.sourceUrl === null) continue;
      ads.push(ad);
    }
    resultCache.set(board.jeton, ads);
    return ads;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interroge chaque tableau curé.
 *
 * Les mots-clés ne sont pas envoyés : l'API n'expose aucun filtre. Le tri se
 * fait dans le crible déterministe du moteur, où il peut s'expliquer — d'où
 * `ignoresKeywords` côté registre des sources.
 */
export async function searchAshby(): Promise<DiscoveredAd[]> {
  const boards = activeAshbyBoards();
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
      log.warn("tableau ashby injoignable", { board: lot[j].jeton });
    });
  }
  return ads;
}
