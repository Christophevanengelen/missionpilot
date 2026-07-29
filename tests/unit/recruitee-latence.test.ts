import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { RECRUITEE_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));

/**
 * Ce que ce fichier protège : le temps d'attente de quelqu'un devant son écran.
 *
 * Le 2026-07-29, le tableau de bord mettait 25 secondes à s'afficher en
 * production, au point de paraître vide. Les logs d'un SEUL affichage
 * contenaient 223 lignes de ce connecteur. Deux causes, aucune détectable par
 * un test fonctionnel — tout « marchait », simplement trop lentement pour être
 * utilisable :
 *
 * 1. quarante-neuf tenants interrogés huit à la fois, soit sept vagues
 *    successives dont chacune attend sa traînarde ;
 * 2. un tenant injoignable n'était jamais mémorisé, donc il repayait son délai
 *    d'expiration complet à CHAQUE visite, indéfiniment.
 *
 * Les deux se re-dégraderaient sans bruit. D'où des tests sur les bornes
 * elles-mêmes, et sur le fait qu'un échec ne se répète pas.
 */

type Mod = typeof import("@/lib/discovery/recruitee");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  vi.resetModules(); // vide les caches du module entre les tests
  mod = await import("@/lib/discovery/recruitee");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

function reponseVide() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ offers: [] }),
  } as Response;
}

describe("le tenant injoignable ne se repaie pas", () => {
  it("n'est PAS rappelé lors de la recherche suivante", async () => {
    // Tout le monde échoue : le pire cas, et celui qui coûtait le plus cher.
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    await mod.searchRecruitee();
    const appelsPremierPassage = fetchMock.mock.calls.length;
    expect(appelsPremierPassage).toBeGreaterThan(0);

    // Deuxième visite, dans la fenêtre d'échec : aucun appel réseau.
    await mod.searchRecruitee();
    expect(fetchMock.mock.calls.length).toBe(appelsPremierPassage);
  });

  it("un tenant qui répond normalement reste interrogé", async () => {
    // Le garde-fou du garde-fou : mémoriser les échecs ne doit pas éteindre la
    // source. Un cache d'échec trop large rendrait le connecteur muet sans que
    // rien ne le signale.
    fetchMock.mockResolvedValue(reponseVide());
    await mod.searchRecruitee();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
  });

  it("un HTTP 404 compte comme un échec, pas comme « zéro offre »", async () => {
    // La cause la plus fréquente dans une liste curée hors ligne : un
    // sous-domaine qui n'existe plus. Le traiter comme un résultat vide le
    // ferait rappeler éternellement.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    await mod.searchRecruitee();
    const appels = fetchMock.mock.calls.length;
    await mod.searchRecruitee();
    expect(fetchMock.mock.calls.length).toBe(appels);
  });
});

describe("les bornes de latence", () => {
  it("interroge les tenants par vagues assez larges pour tenir en deux temps", async () => {
    // 49 tenants à 8 par vague = 7 vagues successives. À 24, il en reste 2 ou 3.
    // Ce test échouera si quelqu'un rabaisse la concurrence sans mesurer.
    fetchMock.mockResolvedValue(reponseVide());
    await mod.searchRecruitee();
    const total = fetchMock.mock.calls.length;
    const { MAX_CONCURRENT_TENANTS, TIMEOUT_MS } = mod.LIMITES_LATENCE;

    expect(MAX_CONCURRENT_TENANTS).toBeGreaterThanOrEqual(16);
    const vagues = Math.ceil(total / MAX_CONCURRENT_TENANTS);
    expect(vagues).toBeLessThanOrEqual(3);

    // Le pire cas théorique, celui qu'on a réellement vécu : chaque vague
    // bloquée par une traînarde jusqu'au délai d'expiration.
    const pireCasMs = vagues * TIMEOUT_MS;
    expect(pireCasMs).toBeLessThanOrEqual(15_000);
  });

  it("n'attend jamais plus de cinq secondes un tenant unique", async () => {
    expect(mod.LIMITES_LATENCE.TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });
});
