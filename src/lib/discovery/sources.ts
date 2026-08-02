import "server-only";

import type { DiscoveredAd } from "./adzuna";
import { adzunaConfigured, searchAdzuna } from "./adzuna";
import { franceTravailConfigured, searchFranceTravail } from "./france-travail";
import { ashbyConfigured, searchAshby } from "./ashby";
import { greenhouseConfigured, searchGreenhouse } from "./greenhouse";
import { himalayasConfigured, searchHimalayas } from "./himalayas";
import { jobicyConfigured, searchJobicy } from "./jobicy";
import { recruiteeConfigured, searchRecruitee } from "./recruitee";
import { remoteOkConfigured, searchRemoteOk } from "./remoteok";
import { remotiveConfigured, searchRemotive } from "./remotive";
import type { DiscoverySource } from "./plan";

/**
 * The legal discovery sources currently CONFIGURED (each inert without its
 * credentials — graceful degradation). Order is stable; discovery runs every
 * one and dedups across them. The `name` is the honest provenance recorded on
 * each imported opportunity.
 */
export function configuredSources(
  countries: readonly string[] = [],
): DiscoverySource<DiscoveredAd>[] {
  const sources: DiscoverySource<DiscoveredAd>[] = [];
  if (adzunaConfigured()) {
    // Adzuna partitions its index BY COUNTRY, so each country is its own
    // source entry. They all keep the name "Adzuna": that is the name their
    // attribution terms require, and it lets the cross-source merge collapse
    // an offer that a company published in two markets.
    const targets = countries.length > 0 ? countries : [undefined];
    for (const country of targets) {
      sources.push({
        name: "Adzuna",
        search: (keywords, mode) => searchAdzuna(keywords, mode, country),
      });
    }
  }
  if (franceTravailConfigured()) {
    sources.push({ name: "France Travail", search: searchFranceTravail });
  }
  if (remotiveConfigured()) {
    sources.push({ name: "Remotive", search: searchRemotive });
  }
  if (himalayasConfigured()) {
    // Himalayas is the only audited source that states pay in structured
    // fields, so it is the one worth pointing at specific countries. One entry
    // per country, like Adzuna — its API accepts exactly one `country` per
    // request, and repeating the parameter returns data for neither.
    //
    // The worldwide search ALWAYS runs, and the chosen countries are added to
    // it — never substituted for it.
    //
    // Correcting a drift of mine: pointing the source at a country narrows it,
    // and narrowing is not what this product is for. The goal is the largest
    // possible set of real opportunities, and then the best match inside it —
    // an offer withheld can never be concluded, whereas an offer shown and
    // ignored costs three seconds. Targeting a country ADDS the roles that
    // only the country query surfaces (755 against 566 on one measured
    // request); it must not remove the rest.
    const targets: (string | undefined)[] = [undefined, ...countries];
    for (const country of targets) {
      sources.push({
        name: "Himalayas",
        search: (keywords) => searchHimalayas(keywords, country),
      });
    }
  }
  if (jobicyConfigured()) {
    sources.push({ name: "Jobicy", search: searchJobicy });
  }
  if (remoteOkConfigured()) {
    // No keyword parameter exists: the feed is the whole current board, and
    // the engine filters it where the person can see and undo the filtering.
    // D'où `ignoresKeywords` : sans lui, le moteur redemande ce même tableau
    // une fois par intitulé cherché.
    sources.push({
      name: "Remote OK",
      search: () => searchRemoteOk(),
      ignoresKeywords: true,
    });
  }
  if (recruiteeConfigured()) {
    // Recruitee exposes no keyword filter, so the search callback ignores the
    // plan and returns the tenants' current openings; the engine's own gate
    // does the filtering, where it can be explained to the user.
    // `ignoresKeywords` compte double ici : chaque appel parcourt TOUS les
    // locataires, et c'est cette source qu'on a fait tomber en 429 le 29/07.
    sources.push({
      name: "Recruitee",
      search: () => searchRecruitee(),
      ignoresKeywords: true,
    });
  }
  if (greenhouseConfigured()) {
    // `ignoresKeywords` pour la même raison que Recruitee, en pire : l'API de
    // tableau Greenhouse n'expose AUCUN filtre — ni recherche, ni lieu, ni
    // date. Interroger une fois par intitulé de métier ferait N appels
    // identiques sur vingt-quatre tableaux, pour le même résultat.
    sources.push({
      name: "Greenhouse",
      search: () => searchGreenhouse(),
      ignoresKeywords: true,
    });
  }
  if (ashbyConfigured()) {
    // `ignoresKeywords` pour la même raison que Greenhouse : l'API n'expose
    // aucun filtre, et interroger une fois par intitulé ferait N appels
    // identiques sur seize tableaux.
    sources.push({
      name: "Ashby",
      search: () => searchAshby(),
      ignoresKeywords: true,
    });
  }
  return sources;
}

/** True when at least one legal discovery source is configured (drives the
 *  inbox's "discover" affordance vs the graceful unconfigured note). */
export function discoveryConfigured(): boolean {
  return configuredSources().length > 0;
}
