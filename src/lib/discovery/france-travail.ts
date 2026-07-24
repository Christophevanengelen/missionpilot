import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import type { DiscoveredAd } from "./adzuna";

/**
 * France Travail connector — the second legal auto-discovery source (owner
 * decision: official APIs only). France Travail's "Offres d'emploi v2" is the
 * public French employment service's OFFICIAL API (OAuth2 client-credentials),
 * 300k+ live French offers coded against the ROME taxonomy — the authoritative
 * French-market source, ToS-permissive by construction. Server-only; the
 * client id/secret ride only in the token request body and are NEVER logged.
 *
 * Graceful degradation: without both credentials, the source is simply inert.
 *
 * HONESTY: fields are mapped only when present. France Travail states salary
 * as FREE TEXT (no reliable structured min/max), so compensation stays null —
 * the salary wording is preserved in the snapshot text for the extractor to
 * read honestly, never parsed into a fabricated figure.
 */

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";
const TIMEOUT_MS = 15_000;
const RESULTS_PER_PAGE = 10;
const TOKEN_SKEW_MS = 30_000; // refresh a little before the token expires

const resultSchema = z.object({
  intitule: z.string().nullish(),
  description: z.string().nullish(),
  entreprise: z.object({ nom: z.string().nullish() }).nullish(),
  lieuTravail: z.object({ libelle: z.string().nullish() }).nullish(),
  typeContrat: z.string().nullish(),
  typeContratLibelle: z.string().nullish(),
  salaire: z.object({ libelle: z.string().nullish() }).nullish(),
  romeLibelle: z.string().nullish(),
  origineOffre: z.object({ urlOrigine: z.string().nullish() }).nullish(),
});

const searchResponseSchema = z.object({
  resultats: z.array(resultSchema).default([]),
});

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().nonnegative().default(1200),
});

export class FranceTravailError extends Error {}

const log = createLogger({ module: "discovery-france-travail" });

export function franceTravailConfigured(): boolean {
  return Boolean(
    env.FRANCE_TRAVAIL_CLIENT_ID && env.FRANCE_TRAVAIL_CLIENT_SECRET,
  );
}

// In-memory token cache: one OAuth token serves the several plan searches of a
// discovery run (and subsequent runs until it nears expiry).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > Date.now()) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.FRANCE_TRAVAIL_CLIENT_ID!,
    client_secret: env.FRANCE_TRAVAIL_CLIENT_SECRET!,
    scope: SCOPE,
  });
  let payload: unknown;
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Status only — the body carries the secret and is never logged.
      log.warn("france travail token failed", { httpStatus: response.status });
      throw new FranceTravailError(`token request failed (${response.status})`);
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof FranceTravailError) throw error;
    throw new FranceTravailError("token request errored");
  }
  const parsed = tokenSchema.safeParse(payload);
  if (!parsed.success) throw new FranceTravailError("token response invalid");
  cachedToken = {
    value: parsed.data.access_token,
    expiresAt: Date.now() + parsed.data.expires_in * 1000,
  };
  return cachedToken.value;
}

function toAd(r: z.infer<typeof resultSchema>): DiscoveredAd {
  const title = r.intitule?.trim() || null;
  const organization = r.entreprise?.nom?.trim() || null;
  const locationText = r.lieuTravail?.libelle?.trim() || null;
  const description = r.description?.trim() || null;
  const contractLabel = r.typeContratLibelle?.trim() || null;
  const salaryText = r.salaire?.libelle?.trim() || null;
  const rome = r.romeLibelle?.trim() || null;
  const rawText = [
    title,
    organization ? `chez ${organization}` : null,
    locationText ? `Lieu : ${locationText}` : null,
    contractLabel ? `Contrat : ${contractLabel}` : null,
    salaryText ? `Salaire : ${salaryText}` : null,
    rome ? `Métier (ROME) : ${rome}` : null,
    "",
    description,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")
    .slice(0, 100_000);
  const redirect = r.origineOffre?.urlOrigine?.trim() || null;
  return {
    title,
    organization,
    description,
    locationText,
    // Only an http(s) URL is kept as provenance (defense in depth — rendered
    // as plain text, never a live link).
    sourceUrl: redirect && /^https?:\/\//i.test(redirect) ? redirect : null,
    // Honest, conservative mapping: CDI ⇒ permanent, mission intérim ⇒ interim,
    // anything else (incl. CDD) stays null — the exact label is in rawText.
    engagementType:
      r.typeContrat === "CDI"
        ? "permanent"
        : r.typeContrat === "MIS"
          ? "interim"
          : null,
    // Salary is free text at France Travail — never fabricate a figure.
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    rawText,
  };
}

/**
 * Search France Travail for offers matching the keywords. Throws
 * `FranceTravailError` on config/HTTP/shape problems (callers surface an
 * honest generic failure). The plan `mode` (any/title) is not a parameter:
 * France Travail's keyword search (motsCles) already targets title+content,
 * and a narrower function is assignable to the DiscoverySource interface.
 */
export async function searchFranceTravail(
  keywords: string[],
): Promise<DiscoveredAd[]> {
  if (!franceTravailConfigured()) {
    throw new FranceTravailError(
      "france travail credentials are not configured",
    );
  }
  const motsCles = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!motsCles) throw new FranceTravailError("no keywords to search");

  const token = await getToken();
  const params = new URLSearchParams({
    motsCles,
    range: `0-${RESULTS_PER_PAGE - 1}`,
  });
  const url = `${SEARCH_URL}?${params}`;

  let body: unknown;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 204 = no results (empty, not an error). 200/206 = content.
    if (response.status === 204) return [];
    if (!response.ok) {
      log.warn("france travail search failed", { httpStatus: response.status });
      throw new FranceTravailError(
        `search request failed (${response.status})`,
      );
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof FranceTravailError) throw error;
    log.warn("france travail search errored", {
      errorType: error instanceof Error ? error.constructor.name : "unknown",
    });
    throw new FranceTravailError("search request errored");
  }

  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("france travail response failed validation", {});
    throw new FranceTravailError("response failed validation");
  }
  return parsed.data.resultats
    .slice(0, RESULTS_PER_PAGE)
    .map(toAd)
    .filter((ad) => ad.rawText.trim() !== "");
}
