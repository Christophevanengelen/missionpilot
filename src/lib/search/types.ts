import type {
  COMP_CURRENCIES,
  COMP_PERIODS,
  EngagementType,
  RemoteType,
} from "@/domain/opportunity";
import type { EligibilityGate } from "@/lib/matching/hard-constraints";

/**
 * One result of a market search — a photograph of an offer as it exists RIGHT
 * NOW on its source, not a stored record.
 *
 * Deliberately NOT carrying `rawText`: a hit crosses to the browser so the
 * result list can be re-filtered instantly, and a hundred snapshots of up to
 * 100 000 characters would be megabytes on the wire. A short `excerpt` is what
 * a search engine shows; the full text lives one click away, at the source.
 */
export type MarketHit = {
  /** Identity for React keys and for deduplicating across a refresh — the
   *  provenance URL when there is one, else the offer's own fingerprint. */
  key: string;
  title: string | null;
  organization: string | null;
  locationText: string | null;
  engagementType: EngagementType | null;
  remoteType: RemoteType | null;
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: (typeof COMP_CURRENCIES)[number] | null;
  compensationPeriod: (typeof COMP_PERIODS)[number] | null;
  skills: string[];
  /** First lines of the description, for the result row. */
  excerpt: string | null;
  /** The platform that served this offer — displayed, and required by several
   *  sources' attribution terms. */
  sourceName: string;
  /** The link the user actually goes to. The product's whole promise is that
   *  this points at the original posting. */
  sourceUrl: string | null;
  /** Deterministic hard-constraint verdict against the saved preferences. */
  gate: EligibilityGate;
  /** 0-100 relevance against confirmed skills, or null when undecidable. */
  score: number | null;
  /**
   * Fields NO source stated. Carried all the way to the UI on purpose: the
   * product says what it does not know rather than presenting a silent blank
   * as a fact, and the filters use this to avoid dropping terse offers.
   */
  unknowns: string[];
};

/** What one search run produced, including what it could NOT reach — a result
 *  that is missing a whole platform must never read as a complete answer. */
export type MarketSearchResult = {
  hits: MarketHit[];
  /** Sources that failed at least one query, with their own denominator. */
  failedSources: { name: string; failed: number; total: number }[];
  /** Platforms actually queried, for an honest "cherché sur N plateformes". */
  searchedSources: string[];
};
