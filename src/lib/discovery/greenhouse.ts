import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";
import { createTtlCache } from "./cache";
import { activeBoards } from "./greenhouse-boards";
import { firstPlainText } from "./html-text";
import { toPostedAt } from "./posted-at";

/**
 * Connecteur Greenhouse — la source qui apporte le plus de volume européen,
 * et la plus simple à justifier.
 *
 * `boards-api.greenhouse.io` est l'API que Greenhouse publie POUR QUE les
 * employeurs affichent leur tableau d'offres ailleurs que sur leur site. Elle
 * répond sans authentification parce qu'elle est faite pour être lue par des
 * tiers. Rien n'est contourné : l'employeur a choisi d'y publier. C'est
 * exactement la forme juridique de Recruitee, que ce produit consomme déjà.
 *
 * `content=true` ET PAS AUTREMENT, pour une raison qui n'est pas de confort :
 * sans ce paramètre, la réponse ne porte que `updated_at`. Afficher une date
 * de MODIFICATION comme une date de publication est le mensonge le plus
 * répandu des agrégateurs — une annonce de mars retouchée hier paraîtrait
 * fraîche. Avec `content=true`, `first_published` arrive, et c'est la vraie
 * date. La contrepartie est une réponse plus lourde ; elle est mise en cache.
 *
 * CE QUE CETTE SOURCE NE SAIT PAS DIRE, et qu'elle ne devine donc pas : le
 * type d'engagement et la rémunération. Greenhouse ne les expose sur aucun
 * champ structuré. Les deux restent `null` plutôt que d'être extraits du texte
 * à coups d'expressions régulières — une fourchette de salaire inventée est
 * pire qu'une fourchette absente, parce qu'on décide dessus.
 *
 * Opt-in : inerte tant que GREENHOUSE_ENABLED n'est pas posé.
 */

const TIMEOUT_MS = 6_000;
/** Les tableaux bougent à l'échelle de la journée, pas de la minute. */
const CACHE_TTL_MS = 30 * 60 * 1000;
/** Un tableau en échec ne coûte plus rien jusqu'à l'expiration de sa fenêtre :
 *  c'est ce qui empêche deux jetons morts de taxer chaque visite. */
const FAILURE_TTL_MS = 10 * 60 * 1000;
/** Borne de parallélisme : la même que Recruitee, pour la même raison — une
 *  source qui ralentit la page est une source qu'on finit par éteindre. */
const MAX_CONCURRENT_BOARDS = 6;

const USER_AGENT =
  "MissionPilot/1.0 (+https://missionpilot.net; open source job search)";

export const LIMITES_LATENCE = {
  TIMEOUT_MS,
  MAX_CONCURRENT_BOARDS,
} as const;

export class GreenhouseError extends Error {}

const log = createLogger({ module: "discovery-greenhouse" });

const resultCache = createTtlCache<DiscoveredAd[]>(CACHE_TTL_MS);
const failureCache = createTtlCache<true>(FAILURE_TTL_MS);

export function greenhouseConfigured(): boolean {
  return env.GREENHOUSE_ENABLED === true && activeBoards().length > 0;
}

const jobSchema = z.object({
  title: z.string().nullish(),
  absolute_url: z.string().nullish(),
  company_name: z.string().nullish(),
  content: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  first_published: z.string().nullish(),
});

/** `jobs` est REQUIS et n'a pas de valeur par défaut : un tableau qui répond
 *  avec une autre enveloppe est une panne à signaler, pas un résultat vide à
 *  afficher comme « rien ne vous correspond ». */
const responseSchema = z.object({ jobs: z.array(jobSchema) });

function toAd(job: z.infer<typeof jobSchema>): DiscoveredAd {
  // Le contenu arrive en HTML échappé. `firstPlainText` est le même chemin que
  // les autres sources : on ne réinvente pas un décodeur par connecteur.
  const description = firstPlainText(job.content ?? null);
  return {
    title: job.title?.trim() || null,
    organization: job.company_name?.trim() || null,
    description,
    locationText: job.location?.name?.trim() || null,
    sourceUrl: job.absolute_url?.trim() || null,
    // Greenhouse n'expose ni type de contrat ni salaire sur un champ
    // structuré. On ne les déduit pas du texte : voir l'en-tête.
    engagementType: null,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    // `first_published`, jamais `updated_at`.
    postedAt: toPostedAt(job.first_published ?? null),
    rawText: description ?? job.title?.trim() ?? "",
  };
}

async function fetchBoard(board: string): Promise<DiscoveredAd[]> {
  const cached = resultCache.get(board);
  if (cached) return cached;
  if (failureCache.get(board)) return [];

  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GreenhouseError(`greenhouse ${board}: HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new GreenhouseError(`greenhouse ${board}: unexpected payload`);
    }
    const ads: DiscoveredAd[] = [];
    for (const job of parsed.data.jobs) {
      const ad = toAd(job);
      // Une annonce sans titre ET sans lien ne peut pas être montrée
      // honnêtement : on ne saurait ni la nommer ni y renvoyer.
      if (ad.title === null && ad.sourceUrl === null) continue;
      ads.push(ad);
    }
    resultCache.set(board, ads);
    return ads;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interroge chaque tableau curé et rend leurs offres.
 *
 * LES MOTS-CLÉS NE SONT PAS ENVOYÉS, et ce n'est pas un oubli : l'API de
 * tableau Greenhouse n'expose aucun filtre — ni recherche, ni lieu, ni date.
 * Le tri se fait donc là où il peut s'expliquer, dans le crible déterministe
 * du moteur. C'est aussi pourquoi cette source est marquée `ignoresKeywords` :
 * l'interroger une fois par intitulé de métier ferait N fois le même appel
 * pour le même résultat.
 *
 * Un tableau en panne ne coule jamais les autres : un jeton mort est normal
 * dans une liste curée hors ligne, et il doit coûter SES résultats, pas la
 * recherche.
 */
export async function searchGreenhouse(): Promise<DiscoveredAd[]> {
  const boards = activeBoards();
  const ads: DiscoveredAd[] = [];
  for (let i = 0; i < boards.length; i += MAX_CONCURRENT_BOARDS) {
    const lot = boards.slice(i, i + MAX_CONCURRENT_BOARDS);
    const regles = await Promise.allSettled(lot.map(fetchBoard));
    regles.forEach((r, j) => {
      if (r.status === "fulfilled") {
        ads.push(...r.value);
        return;
      }
      // Le jeton est journalisé, pas la raison détaillée : un message d'erreur
      // de `fetch` peut contenir l'URL entière, et les journaux ne sont pas
      // l'endroit où l'on découvre quelles sociétés on interroge.
      failureCache.set(lot[j], true);
      log.warn("tableau greenhouse injoignable", { board: lot[j] });
    });
  }
  return ads;
}
