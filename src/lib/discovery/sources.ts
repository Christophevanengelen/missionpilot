import "server-only";

import type { DiscoveredAd } from "./adzuna";
import { adzunaConfigured, searchAdzuna } from "./adzuna";
import { franceTravailConfigured, searchFranceTravail } from "./france-travail";
import type { DiscoverySource } from "./plan";

/**
 * The legal discovery sources currently CONFIGURED (each inert without its
 * credentials — graceful degradation). Order is stable; discovery runs every
 * one and dedups across them. The `name` is the honest provenance recorded on
 * each imported opportunity.
 */
export function configuredSources(): DiscoverySource<DiscoveredAd>[] {
  const sources: DiscoverySource<DiscoveredAd>[] = [];
  if (adzunaConfigured()) {
    sources.push({ name: "Adzuna", search: searchAdzuna });
  }
  if (franceTravailConfigured()) {
    sources.push({ name: "France Travail", search: searchFranceTravail });
  }
  return sources;
}

/** True when at least one legal discovery source is configured (drives the
 *  inbox's "discover" affordance vs the graceful unconfigured note). */
export function discoveryConfigured(): boolean {
  return configuredSources().length > 0;
}
