import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { envState } = vi.hoisted(() => ({
  envState: { GREENHOUSE_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));
vi.mock("@/lib/env", () => ({ env: envState }));
// Une liste réduite : ces tests portent sur le MAPPING et sur la tolérance à
// la panne, pas sur les vingt-quatre employeurs curés. Les faire tous
// répondre n'ajouterait que du bruit.
vi.mock("@/lib/discovery/greenhouse-boards", async (orig) => ({
  ...(await orig<typeof import("@/lib/discovery/greenhouse-boards")>()),
  activeBoards: () => ["alpha", "beta"],
}));

type Mod = typeof import("@/lib/discovery/greenhouse");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  envState.GREENHOUSE_ENABLED = true;
  vi.resetModules();
  mod = await import("@/lib/discovery/greenhouse");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const JOB = {
  title: "Staff Engineer",
  absolute_url: "https://job-boards.greenhouse.io/n26/jobs/1",
  company_name: "N26",
  content: "&lt;p&gt;Build the bank.&lt;/p&gt;",
  location: { name: "Paris" },
  first_published: "2026-06-09T11:38:32-04:00",
  updated_at: "2026-07-30T09:48:58-04:00",
};

describe("la fraîcheur n'est jamais devinée", () => {
  it("retient la date de PUBLICATION, jamais celle de modification", async () => {
    // Le mensonge le plus répandu des agrégateurs : présenter une annonce de
    // juin retouchée hier comme fraîche d'hier. C'est pour cette seule raison
    // que l'appel demande `content=true` — sans ce paramètre, la réponse ne
    // porte que `updated_at`.
    fetchMock.mockResolvedValue(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchGreenhouse();
    expect(ad.postedAt).toContain("2026-06-09");
    expect(ad.postedAt).not.toContain("2026-07-30");
  });

  it("demande explicitement le contenu, sans quoi la date juste n'arrive pas", async () => {
    fetchMock.mockResolvedValue(ok({ jobs: [] }));
    await mod.searchGreenhouse();
    expect(String(fetchMock.mock.calls[0][0])).toContain("content=true");
  });

  it("dit qu'elle ne sait pas plutôt que d'inventer une date", async () => {
    fetchMock.mockResolvedValue(
      ok({ jobs: [{ ...JOB, first_published: null }] }),
    );
    const [ad] = await mod.searchGreenhouse();
    expect(ad.postedAt).toBeNull();
  });
});

describe("ce que la source ne sait pas, elle ne le devine pas", () => {
  it("laisse contrat et salaire à null — Greenhouse ne les structure pas", async () => {
    // La tentation serait de les extraire du texte à coups d'expressions
    // régulières. Une fourchette de salaire inventée est pire qu'une
    // fourchette absente : on décide dessus.
    fetchMock.mockResolvedValue(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchGreenhouse();
    expect(ad.engagementType).toBeNull();
    expect(ad.compensationMin).toBeNull();
    expect(ad.compensationMax).toBeNull();
    expect(ad.compensationCurrency).toBeNull();
    expect(ad.compensationPeriod).toBeNull();
  });

  it("rend le reste tel que la source l'annonce", async () => {
    fetchMock.mockResolvedValue(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchGreenhouse();
    expect(ad.title).toBe("Staff Engineer");
    expect(ad.organization).toBe("N26");
    expect(ad.locationText).toBe("Paris");
    expect(ad.sourceUrl).toBe("https://job-boards.greenhouse.io/n26/jobs/1");
    expect(ad.description).toContain("Build the bank");
  });

  it("écarte une annonce qu'on ne saurait ni nommer ni ouvrir", async () => {
    fetchMock.mockResolvedValue(
      ok({ jobs: [{ ...JOB, title: null, absolute_url: null }] }),
    );
    expect(await mod.searchGreenhouse()).toEqual([]);
  });
});

describe("un tableau en panne ne coule pas la recherche", () => {
  it("garde les résultats des autres quand un tableau répond 404", async () => {
    // Un jeton mort est NORMAL dans une liste curée hors ligne. Il doit coûter
    // ses résultats à lui, pas la recherche de la personne.
    fetchMock
      .mockResolvedValueOnce(ok({ jobs: [JOB] }))
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const ads = await mod.searchGreenhouse();
    expect(ads).toHaveLength(1);
  });

  it("survit à une enveloppe inattendue plutôt que de rendre une liste vide silencieuse", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ pas_ce_qu_on_attend: true }))
      .mockResolvedValueOnce(ok({ jobs: [JOB] }));
    const ads = await mod.searchGreenhouse();
    expect(ads).toHaveLength(1);
  });

  it("ne rappelle pas un tableau déjà en échec dans la même fenêtre", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await mod.searchGreenhouse();
    const apresPremierTour = fetchMock.mock.calls.length;
    await mod.searchGreenhouse();
    // Deux tableaux, deux appels au premier tour ; le second tour n'en ajoute
    // aucun. C'est ce qui empêche des jetons morts de taxer chaque visite.
    expect(fetchMock.mock.calls.length).toBe(apresPremierTour);
  });
});

describe("la source est inerte tant qu'on ne l'a pas allumée", () => {
  it("n'est pas configurée sans l'interrupteur", async () => {
    envState.GREENHOUSE_ENABLED = false;
    vi.resetModules();
    const off = await import("@/lib/discovery/greenhouse");
    expect(off.greenhouseConfigured()).toBe(false);
  });
});
