import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    FRANCE_TRAVAIL_CLIENT_ID: "test-client-id",
    FRANCE_TRAVAIL_CLIENT_SECRET: "test-client-secret",
    LOG_LEVEL: "error",
    APP_ENV: "local",
  },
}));

// Re-import a FRESH module per test so the in-memory OAuth token cache never
// leaks across cases (each test controls exactly how many fetches happen).
type Mod = typeof import("@/lib/discovery/france-travail");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  vi.resetModules();
  mod = await import("@/lib/discovery/france-travail");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function tokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: "tok-123", expires_in: 1200 }),
  } as Response;
}

const SEARCH_FIXTURE = {
  resultats: [
    {
      intitule: "Data Engineer Senior",
      description: "Pipelines Spark.",
      entreprise: { nom: "Nova" },
      lieuTravail: { libelle: "Paris (75)" },
      typeContrat: "CDI",
      typeContratLibelle: "Contrat à durée indéterminée",
      salaire: { libelle: "Annuel de 55000,00 Euros" },
      romeLibelle: "Data engineer",
      origineOffre: {
        urlOrigine: "https://candidat.francetravail.fr/offres/1",
      },
    },
    {
      intitule: "Mission Data",
      description: "Renfort ponctuel.",
      typeContrat: "MIS",
      origineOffre: { urlOrigine: "javascript:alert(1)" }, // dropped
    },
  ],
};

describe("searchFranceTravail", () => {
  it("is configured with both credentials", () => {
    expect(mod.franceTravailConfigured()).toBe(true);
  });

  it("fetches a token then maps offers honestly (salary stays null — free text)", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => SEARCH_FIXTURE,
    } as Response);

    const ads = await mod.searchFranceTravail(["data engineer"]);
    expect(ads).toHaveLength(2);

    const full = ads[0];
    expect(full.title).toBe("Data Engineer Senior");
    expect(full.organization).toBe("Nova");
    expect(full.locationText).toBe("Paris (75)");
    expect(full.engagementType).toBe("permanent"); // CDI
    expect(full.sourceUrl).toBe("https://candidat.francetravail.fr/offres/1");
    // Salary is free text → never fabricated into a figure.
    expect(full.compensationMin).toBeNull();
    expect(full.compensationCurrency).toBeNull();
    // …but the wording is preserved for the extractor.
    expect(full.rawText).toContain("Salaire : Annuel de 55000,00 Euros");
    expect(full.rawText).toContain("Métier (ROME) : Data engineer");

    const mis = ads[1];
    expect(mis.engagementType).toBe("interim"); // MIS
    expect(mis.sourceUrl).toBeNull(); // non-http(s) dropped
  });

  it("sends the token as a Bearer header and never puts creds in the URL", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ resultats: [] }),
    } as Response);
    await mod.searchFranceTravail(["a", "b", "c", "d", "e", "f"]);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toContain("access_token");
    expect((tokenInit as RequestInit).method).toBe("POST");
    const [searchUrl, searchInit] = fetchMock.mock.calls[1];
    const parsed = new URL(String(searchUrl));
    expect(parsed.hostname).toBe("api.francetravail.io");
    expect(parsed.searchParams.get("motsCles")).toBe("a b c d e"); // capped at 5
    expect(parsed.searchParams.has("client_secret")).toBe(false);
    expect(
      (searchInit as RequestInit & { headers: Record<string, string> }).headers
        .Authorization,
    ).toBe("Bearer tok-123");
  });

  it("reuses the cached token across searches in a run (one token fetch)", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ resultats: [] }),
    } as Response);
    await mod.searchFranceTravail(["x"]);
    await mod.searchFranceTravail(["y"]);
    // token(1) + search(1) + search(1) = 3, NOT 4 (token not re-fetched).
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats HTTP 204 as an empty result, not an error", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: false,
      status: 204,
      json: async () => ({}),
    } as Response);
    await expect(mod.searchFranceTravail(["x"])).resolves.toEqual([]);
  });

  it("throws a typed error on a token failure and on an invalid search shape", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);
    await expect(mod.searchFranceTravail(["x"])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );

    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ resultats: "nope" }),
    } as Response);
    await expect(mod.searchFranceTravail(["x"])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );
  });

  it("rejects an empty keyword set (before any network call)", async () => {
    await expect(mod.searchFranceTravail(["  ", ""])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
