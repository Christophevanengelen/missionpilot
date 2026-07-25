import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    FRANCE_TRAVAIL_CLIENT_ID: "test-client-id",
    FRANCE_TRAVAIL_CLIENT_SECRET: "test-client-secret",
    // "warn" so the token-failure diagnostics below are actually emitted.
    LOG_LEVEL: "warn",
    APP_ENV: "local",
  },
}));

// Re-import a FRESH module per test so the in-memory OAuth token cache never
// leaks across cases (each test controls exactly how many fetches happen).
type Mod = typeof import("@/lib/discovery/france-travail");
let mod: Mod;
const fetchMock = vi.fn();
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.resetModules();
  mod = await import("@/lib/discovery/france-travail");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
});

/** The structured JSON of the most recent warn line. */
function lastWarnLine(): string {
  return warnSpy.mock.calls.at(-1)?.[0] as string;
}

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

  // The production incident this guards: every France Travail search failed
  // with HTTP 400 and the log carried the status ALONE. "400" cannot tell a
  // wrong credential (invalid_client) from an application that is simply not
  // subscribed to the Offres d'emploi API (invalid_scope) — two opposite fixes.
  it("logs the OAuth error CODE on a token failure, never the free-text description", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "invalid_scope",
        error_description: "scope non autorise pour cette application",
      }),
    } as Response);
    await expect(mod.searchFranceTravail(["x"])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );
    const line = lastWarnLine();
    const logged = JSON.parse(line);
    expect(logged.httpStatus).toBe(400);
    expect(logged.oauthError).toBe("invalid_scope");
    // Free text is outside our control — it never reaches the log.
    expect(line).not.toContain("scope non autorise");
    // And the credentials never do either.
    expect(line).not.toContain("test-client-secret");
    expect(line).not.toContain("test-client-id");
  });

  it("still reports the status when the token error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    await expect(mod.searchFranceTravail(["x"])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );
    const logged = JSON.parse(lastWarnLine());
    expect(logged.httpStatus).toBe(502);
    expect(logged.oauthError).toBeNull();
  });

  it("rejects an empty keyword set (before any network call)", async () => {
    await expect(mod.searchFranceTravail(["  ", ""])).rejects.toBeInstanceOf(
      mod.FranceTravailError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
