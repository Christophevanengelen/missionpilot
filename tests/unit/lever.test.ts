import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { envState } = vi.hoisted(() => ({
  envState: { LEVER_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/discovery/lever-boards", async (orig) => ({
  ...(await orig<typeof import("@/lib/discovery/lever-boards")>()),
  activeLeverBoards: () => [{ jeton: "swile", nom: "Swile" }],
}));

type Mod = typeof import("@/lib/discovery/lever");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  envState.LEVER_ENABLED = true;
  vi.resetModules();
  mod = await import("@/lib/discovery/lever");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

/** La réponse de Lever est un TABLEAU nu, pas une enveloppe. */
function ok(postings: unknown[]) {
  return { ok: true, status: 200, json: async () => postings } as Response;
}

const POSTING = {
  text: "Ingénieur back-end",
  hostedUrl: "https://jobs.lever.co/swile/abc",
  descriptionPlain: "Construire la carte.",
  country: "FR",
  createdAt: 1784569799619,
  categories: {
    commitment: "Permanent",
    location: "Paris",
    allLocations: ["Paris", "Lyon"],
  },
};

function avecCommitment(commitment: string | null) {
  return { ...POSTING, categories: { ...POSTING.categories, commitment } };
}

/**
 * LE VRAI SUJET DE CE FICHIER.
 *
 * `categories.commitment` ressemble à un champ structuré et n'en est pas un :
 * c'est du texte libre saisi par chaque employeur. Ces tests fixent la règle —
 * on ne traduit que sur un mot EXPLICITE — parce que c'est exactement le champ
 * qu'un futur « rapprochement approximatif » viendrait remplir au jugé.
 */
describe("l'engagement n'est traduit que sur un mot explicite", () => {
  it.each([
    ["Permanent", "permanent"],
    ["NL Permanent employee", "permanent"],
    ["Contractor", "freelance"],
    ["Full Time Contractor", "freelance"],
    ["Short Term", "interim"],
    ["Fixed-Term", "interim"],
    ["Temporary - Full-time", "interim"],
  ])("traduit « %s » en %s", async (commitment, attendu) => {
    fetchMock.mockResolvedValue(ok([avecCommitment(commitment)]));
    const [ad] = await mod.searchLever();
    expect(ad.engagementType).toBe(attendu);
  });

  it("laisse « Full-time » VIDE — ce n'est pas un type de contrat", async () => {
    // C'est la décision la plus contre-intuitive du connecteur, et elle suit
    // le contrat du champ : « the engagement the source EXPLICITLY states ».
    // Une durée hebdomadaire ne dit rien de l'engagement. La remplir par
    // « permanent » ferait annoncer comme salariés des postes qui ne le sont
    // pas — sur la ligne que la personne lit en premier.
    fetchMock.mockResolvedValue(ok([avecCommitment("Full-time")]));
    const [ad] = await mod.searchLever();
    expect(ad.engagementType).toBeNull();
  });

  it.each(["FR Executive/Cadre", "BE Employee", "Regular"])(
    "laisse « %s » vide plutôt que de deviner",
    async (commitment) => {
      fetchMock.mockResolvedValue(ok([avecCommitment(commitment)]));
      const [ad] = await mod.searchLever();
      expect(ad.engagementType).toBeNull();
    },
  );

  it("préfère le mot le plus SPÉCIFIQUE quand deux se disputent", async () => {
    // « Permanent - Part-time » porte les deux. Savoir qu'un poste est à temps
    // partiel change une décision ; savoir qu'il est permanent la change
    // moins. Le plus informatif gagne.
    fetchMock.mockResolvedValue(ok([avecCommitment("Permanent - Part-time")]));
    const [ad] = await mod.searchLever();
    expect(ad.engagementType).toBe("part_time");
  });

  it.each(["Internship", "Apprenticeship", "Scholarship"])(
    "ne range pas « %s » dans un type du domaine",
    async (commitment) => {
      fetchMock.mockResolvedValue(ok([avecCommitment(commitment)]));
      const [ad] = await mod.searchLever();
      expect(ad.engagementType).toBeNull();
    },
  );

  it("supporte un commitment absent", async () => {
    fetchMock.mockResolvedValue(ok([avecCommitment(null)]));
    const [ad] = await mod.searchLever();
    expect(ad.engagementType).toBeNull();
  });
});

describe("le reste du mapping", () => {
  it("convertit la date epoch en ISO", async () => {
    fetchMock.mockResolvedValue(ok([POSTING]));
    const [ad] = await mod.searchLever();
    expect(ad.postedAt).toBe(new Date(1784569799619).toISOString());
  });

  it("rend null sur une date inexploitable plutôt qu'une date invalide", async () => {
    // Une `Invalid Date` affichée passerait pour une offre fraîche.
    fetchMock.mockResolvedValue(ok([{ ...POSTING, createdAt: null }]));
    const [ad] = await mod.searchLever();
    expect(ad.postedAt).toBeNull();
  });

  it("réunit les lieux sans doublon", async () => {
    fetchMock.mockResolvedValue(ok([POSTING]));
    const [ad] = await mod.searchLever();
    expect(ad.locationText).toBe("Paris · Lyon · FR");
  });

  it("nomme l'entreprise depuis la liste — Lever ne la renvoie pas", async () => {
    fetchMock.mockResolvedValue(ok([POSTING]));
    const [ad] = await mod.searchLever();
    expect(ad.organization).toBe("Swile");
  });

  it("écarte une annonce qu'on ne saurait ni nommer ni ouvrir", async () => {
    fetchMock.mockResolvedValue(
      ok([{ ...POSTING, text: null, hostedUrl: null }]),
    );
    expect(await mod.searchLever()).toEqual([]);
  });
});

describe("tolérance à la panne et interrupteur", () => {
  it("rend une liste vide sur HTTP 404 sans lever", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await mod.searchLever()).toEqual([]);
  });

  it("refuse une enveloppe qui n'est pas un tableau", async () => {
    // Lever rend un tableau nu ; recevoir un objet est une panne à signaler,
    // pas un résultat vide à afficher comme « rien ne vous correspond ».
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ postings: [] }),
    } as Response);
    expect(await mod.searchLever()).toEqual([]);
  });

  it("n'est pas configurée sans l'interrupteur", async () => {
    envState.LEVER_ENABLED = false;
    vi.resetModules();
    const off = await import("@/lib/discovery/lever");
    expect(off.leverConfigured()).toBe(false);
  });
});
