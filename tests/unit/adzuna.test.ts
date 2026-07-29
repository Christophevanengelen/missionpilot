import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    ADZUNA_APP_ID: "test-app-id",
    ADZUNA_APP_KEY: "test-app-key",
    ADZUNA_COUNTRY: "fr",
    LOG_LEVEL: "error",
    APP_ENV: "local",
  },
}));

const {
  AdzunaError,
  adzunaConfigured,
  adzunaRateLimited,
  resetAdzunaRateLimit,
  searchAdzuna,
} = await import("@/lib/discovery/adzuna");

const FIXTURE = {
  results: [
    {
      title: "Senior Data Engineer",
      description: "Pipeline Spark et Airflow pour une scale-up.",
      redirect_url: "https://www.adzuna.fr/land/ad/123",
      company: { display_name: "Scaleup SA" },
      location: { display_name: "Paris, Île-de-France" },
      contract_type: "permanent",
      // Deliberately swapped: the connector must repair min > max.
      salary_min: 65000,
      salary_max: 50000,
    },
    {
      title: "Consultant DevOps",
      description: null,
      redirect_url: null,
      company: null,
      location: null,
      contract_type: "contract",
      salary_min: null,
      salary_max: null,
    },
  ],
};

describe("searchAdzuna", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    /* Le recul après 429 vit dans le module, donc il survit d'un test à
       l'autre. Sans cette remise à zéro, un seul test de 429 ferait échouer
       tous les suivants — pour une raison invisible dans leur code. */
    resetAdzunaRateLimit();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is configured with both credentials", () => {
    expect(adzunaConfigured()).toBe(true);
  });

  it("maps ads honestly: structured fields, repaired salary, EUR/year only with a figure", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FIXTURE,
    } as Response);
    const ads = await searchAdzuna(["data engineer"]);
    expect(ads).toHaveLength(2);

    const full = ads[0];
    expect(full.title).toBe("Senior Data Engineer");
    expect(full.organization).toBe("Scaleup SA");
    expect(full.locationText).toBe("Paris, Île-de-France");
    expect(full.engagementType).toBe("permanent");
    expect(full.compensationMin).toBe(50000); // swapped pair repaired
    expect(full.compensationMax).toBe(65000);
    expect(full.compensationCurrency).toBe("EUR");
    expect(full.compensationPeriod).toBe("year");
    expect(full.sourceUrl).toBe("https://www.adzuna.fr/land/ad/123");
    expect(full.rawText).toContain("Senior Data Engineer");
    expect(full.rawText).toContain("chez Scaleup SA");

    const minimal = ads[1];
    expect(minimal.engagementType).toBe("interim"); // contract mapping
    expect(minimal.organization).toBeNull();
    expect(minimal.compensationCurrency).toBeNull(); // no figure ⇒ no claim
    expect(minimal.compensationPeriod).toBeNull();
  });

  it("nulls the WHOLE compensation block for predicted (estimated) salaries", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: "Data Engineer",
            description: "Poste sans salaire affiché.",
            salary_min: 48000,
            salary_max: 52000,
            salary_is_predicted: "1", // Adzuna's model estimate — NOT stated
          },
          {
            title: "Autre poste",
            description: "Idem, flag numérique.",
            salary_min: 40000,
            salary_max: 45000,
            salary_is_predicted: 1,
          },
        ],
      }),
    } as Response);
    const ads = await searchAdzuna(["data"]);
    for (const ad of ads) {
      expect(ad.compensationMin).toBeNull();
      expect(ad.compensationMax).toBeNull();
      expect(ad.compensationCurrency).toBeNull();
      expect(ad.compensationPeriod).toBeNull();
    }
  });

  it("drops a non-http(s) redirect_url instead of storing it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: "X",
            description: "d",
            redirect_url: "javascript:alert(1)",
          },
        ],
      }),
    } as Response);
    const ads = await searchAdzuna(["x"]);
    expect(ads[0].sourceUrl).toBeNull();
  });

  it("sends credentials only in the request URL (never logged), uses OR keywords, bounded", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);
    await searchAdzuna(["a", "b", "c", "d", "e", "f", "g"]);
    const [calledUrl] = fetchMock.mock.calls[0];
    const parsed = new URL(String(calledUrl));
    expect(parsed.hostname).toBe("api.adzuna.com");
    expect(parsed.searchParams.get("app_id")).toBe("test-app-id");
    // OR semantics + keywords capped at 5.
    expect(parsed.searchParams.get("what_or")).toBe("a b c d e");
  });

  it("title mode targets the ad TITLE (title_only), not the whole ad", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);
    await searchAdzuna(["Data Engineer"], "title");
    const [calledUrl] = fetchMock.mock.calls[0];
    const parsed = new URL(String(calledUrl));
    expect(parsed.searchParams.get("title_only")).toBe("Data Engineer");
    expect(parsed.searchParams.get("what_or")).toBeNull();
  });

  it("throws a typed error on HTTP failure and on invalid shape", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);
    await expect(searchAdzuna(["x"])).rejects.toBeInstanceOf(AdzunaError);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: "not-an-array" }),
    } as Response);
    await expect(searchAdzuna(["x"])).rejects.toBeInstanceOf(AdzunaError);
  });

  it("rejects an empty keyword set", async () => {
    await expect(searchAdzuna(["  ", ""])).rejects.toBeInstanceOf(AdzunaError);
  });

  /**
   * Le recul après un 429.
   *
   * Constaté en production le 2026-07-29 : Adzuna répondait 429 à chaque
   * affichage du tableau de bord, et chaque affichage relançait la requête.
   * Insister n'ouvre aucun quota — ça ajoute de la latence à une page déjà
   * lente et ça cogne sur une API qui vient de demander l'arrêt.
   */
  describe("après un 429", () => {
    async function declencher429() {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response);
      await expect(searchAdzuna(["Data Engineer"])).rejects.toBeInstanceOf(
        AdzunaError,
      );
    }

    it("n'appelle PLUS le réseau pendant le refroidissement", async () => {
      await declencher429();
      expect(adzunaRateLimited()).toBe(true);
      const appelsApresLe429 = fetchMock.mock.calls.length;

      // La source répondrait 200 maintenant : peu importe, on ne l'appelle pas.
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      } as Response);
      await expect(searchAdzuna(["Data Engineer"])).rejects.toBeInstanceOf(
        AdzunaError,
      );
      expect(fetchMock.mock.calls.length).toBe(appelsApresLe429);
    });

    it("ne déclenche PAS de recul sur les autres échecs", async () => {
      // 401 veut dire « vos identifiants sont faux », 500 « nous avons un
      // problème ». Ni l'un ni l'autre n'est une demande de silence, et se
      // taire un quart d'heure sur une panne passagère coûterait des résultats.
      for (const status of [401, 403, 500, 503]) {
        resetAdzunaRateLimit();
        fetchMock.mockResolvedValue({
          ok: false,
          status,
          json: async () => ({}),
        } as Response);
        await expect(searchAdzuna(["x"])).rejects.toBeInstanceOf(AdzunaError);
        expect(adzunaRateLimited()).toBe(false);
      }
    });

    it("se rouvre tout seul une fois la fenêtre passée", async () => {
      // Un déblocage ne doit jamais exiger un redéploiement.
      await declencher429();
      const dansSeizeMinutes = Date.now() + 16 * 60 * 1000;
      expect(adzunaRateLimited(dansSeizeMinutes)).toBe(false);
    });
  });
});
