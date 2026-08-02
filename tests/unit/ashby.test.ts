import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { envState } = vi.hoisted(() => ({
  envState: { ASHBY_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/discovery/ashby-boards", async (orig) => ({
  ...(await orig<typeof import("@/lib/discovery/ashby-boards")>()),
  activeAshbyBoards: () => [{ jeton: "alan", nom: "Alan" }],
}));

type Mod = typeof import("@/lib/discovery/ashby");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  envState.ASHBY_ENABLED = true;
  vi.resetModules();
  mod = await import("@/lib/discovery/ashby");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function ok(jobs: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ jobs }) } as Response;
}

const JOB = {
  title: "Ingénieur plateforme",
  jobUrl: "https://jobs.ashbyhq.com/alan/abc",
  descriptionPlain: "Construire la plateforme.",
  location: "Paris",
  secondaryLocations: [{ location: "Remote (Europe)" }],
  employmentType: "Contract",
  publishedAt: "2026-07-02T14:50:57.993+00:00",
  isListed: true,
};

describe("le type d'engagement est DIT, pas deviné", () => {
  it("traduit Contract en freelance — la distinction est le cœur du produit", async () => {
    fetchMock.mockResolvedValue(ok([JOB]));
    const [ad] = await mod.searchAshby();
    expect(ad.engagementType).toBe("freelance");
  });

  it.each([
    ["FullTime", "permanent"],
    ["PartTime", "part_time"],
    ["Temporary", "interim"],
  ])("traduit %s en %s", async (ashby, attendu) => {
    fetchMock.mockResolvedValue(ok([{ ...JOB, employmentType: ashby }]));
    const [ad] = await mod.searchAshby();
    expect(ad.engagementType).toBe(attendu);
  });

  it("laisse un stage SANS type plutôt que de le ranger de force", async () => {
    // Un stage n'est ni freelance, ni temps partiel, ni intérim, ni permanent.
    // Le rabattre sur « permanent » parce que c'est le cas fréquent serait un
    // mensonge sur la première chose que la personne regarde.
    fetchMock.mockResolvedValue(ok([{ ...JOB, employmentType: "Intern" }]));
    const [ad] = await mod.searchAshby();
    expect(ad.engagementType).toBeNull();
  });

  it("laisse vide un type inconnu au lieu d'inventer une correspondance", async () => {
    fetchMock.mockResolvedValue(
      ok([{ ...JOB, employmentType: "Apprenticeship" }]),
    );
    const [ad] = await mod.searchAshby();
    expect(ad.engagementType).toBeNull();
  });
});

describe("ce qui est affiché vient de la source ou de la liste curée", () => {
  it("garde les lieux secondaires — c'est souvent eux qui rendent éligible", async () => {
    // « Paris » puis « Remote (Europe) » : c'est la même offre, et la seconde
    // ligne est celle qui décide pour beaucoup de gens.
    fetchMock.mockResolvedValue(ok([JOB]));
    const [ad] = await mod.searchAshby();
    expect(ad.locationText).toBe("Paris · Remote (Europe)");
  });

  it("nomme l'entreprise depuis la liste — Ashby ne la renvoie pas", async () => {
    // Sans ça, l'écran afficherait le jeton technique « alan ».
    fetchMock.mockResolvedValue(ok([JOB]));
    const [ad] = await mod.searchAshby();
    expect(ad.organization).toBe("Alan");
  });

  it("retient la date de publication", async () => {
    fetchMock.mockResolvedValue(ok([JOB]));
    const [ad] = await mod.searchAshby();
    expect(ad.postedAt).toContain("2026-07-02");
  });

  it("n'invente aucune rémunération", async () => {
    fetchMock.mockResolvedValue(ok([JOB]));
    const [ad] = await mod.searchAshby();
    expect(ad.compensationMin).toBeNull();
    expect(ad.compensationMax).toBeNull();
  });
});

describe("on respecte ce que l'employeur a retiré", () => {
  it("ignore une annonce dépubliée du tableau", async () => {
    // `isListed: false` : l'employeur l'a sortie de son tableau public tout en
    // la gardant joignable par lien direct. La relayer irait contre sa
    // décision.
    fetchMock.mockResolvedValue(ok([{ ...JOB, isListed: false }]));
    expect(await mod.searchAshby()).toEqual([]);
  });

  it("garde une annonce quand le champ est absent — l'absence n'est pas un retrait", async () => {
    const sansChamp: Record<string, unknown> = { ...JOB };
    delete sansChamp.isListed;
    fetchMock.mockResolvedValue(ok([sansChamp]));
    expect(await mod.searchAshby()).toHaveLength(1);
  });
});

describe("une panne coûte ses résultats, pas la recherche", () => {
  it("rend une liste vide sur HTTP 500 sans lever", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await mod.searchAshby()).toEqual([]);
  });

  it("ne rappelle pas un tableau déjà en échec dans la même fenêtre", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await mod.searchAshby();
    const apres = fetchMock.mock.calls.length;
    await mod.searchAshby();
    expect(fetchMock.mock.calls.length).toBe(apres);
  });
});

describe("la source est inerte tant qu'on ne l'a pas allumée", () => {
  it("n'est pas configurée sans l'interrupteur", async () => {
    envState.ASHBY_ENABLED = false;
    vi.resetModules();
    const off = await import("@/lib/discovery/ashby");
    expect(off.ashbyConfigured()).toBe(false);
  });
});
