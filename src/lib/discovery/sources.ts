import "server-only";

import type { DiscoveredAd } from "./adzuna";
import { adzunaConfigured, searchAdzuna } from "./adzuna";
import { franceTravailConfigured, searchFranceTravail } from "./france-travail";
import { himalayasConfigured, searchHimalayas } from "./himalayas";
import { jobicyConfigured, searchJobicy } from "./jobicy";
import { recruiteeConfigured, searchRecruitee } from "./recruitee";
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
    // With no country chosen it searches worldwide, which is the honest
    // default: a remote role is not disqualified by where its employer sits.
    const targets = countries.length > 0 ? countries : [undefined];
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
  if (recruiteeConfigured()) {
    // Recruitee exposes no keyword filter, so the search callback ignores the
    // plan and returns the tenants' current openings; the engine's own gate
    // does the filtering, where it can be explained to the user.
    sources.push({ name: "Recruitee", search: () => searchRecruitee() });
  }
  return sources;
}

/** True when at least one legal discovery source is configured (drives the
 *  inbox's "discover" affordance vs the graceful unconfigured note). */
export function discoveryConfigured(): boolean {
  return configuredSources().length > 0;
}
