import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { creerJeton, desabonnerParJeton } =
  await import("@/lib/digest/abonnement");
const { doitEnvoyer } = await import("@/workflows/digest-logic");

/**
 * L'abonnement : le jeton, et la cadence.
 *
 * Ces deux mécanismes ont en commun d'être invisibles quand ils marchent et
 * coûteux quand ils ratent — un jeton devinable laisse désabonner autrui, une
 * cadence mal bornée envoie deux fois le même lundi. Ni l'un ni l'autre ne se
 * remarque en regardant l'écran.
 */

describe("le jeton de désabonnement", () => {
  it("fait 64 caractères hexadécimaux, comme la contrainte l'exige", () => {
    expect(creerJeton()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne se répète pas", () => {
    // La seule propriété de sécurité de ce jeton : il désabonne SANS
    // authentifier, donc un générateur prévisible permettrait de désabonner
    // quelqu'un d'autre en devinant.
    const jetons = new Set(Array.from({ length: 200 }, () => creerJeton()));
    expect(jetons.size).toBe(200);
  });
});

describe("le désabonnement par jeton", () => {
  /** Un client minimal : on n'a besoin que de savoir si la requête part. */
  function clientEspion(lignes: { profile_id: string }[] | null) {
    let atteint = false;
    const client = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: async () => {
              atteint = true;
              return { data: lignes, error: null };
            },
          }),
        }),
      }),
    };
    return { client, aTouche: () => atteint };
  }

  it("refuse un jeton mal formé SANS interroger la base", async () => {
    // Écarter tôt évite d'offrir un oracle de temps sur ce qui existe ou non,
    // et épargne une requête à chaque URL tronquée par un client mail.
    const { client, aTouche } = clientEspion([{ profile_id: "x" }]);
    for (const mauvais of ["", "abc", "Z".repeat(64), "a".repeat(63)]) {
      const r = await desabonnerParJeton(
        client as unknown as Parameters<typeof desabonnerParJeton>[0],
        mauvais,
      );
      expect(r.trouve).toBe(false);
    }
    expect(aTouche()).toBe(false);
  });

  it("dit « pas trouvé » sur un jeton bien formé mais inconnu", async () => {
    const { client } = clientEspion([]);
    const r = await desabonnerParJeton(
      client as unknown as Parameters<typeof desabonnerParJeton>[0],
      "a".repeat(64),
    );
    expect(r.trouve).toBe(false);
  });

  it("désabonne sur un jeton connu", async () => {
    const { client } = clientEspion([{ profile_id: "p1" }]);
    const r = await desabonnerParJeton(
      client as unknown as Parameters<typeof desabonnerParJeton>[0],
      "b".repeat(64),
    );
    expect(r.trouve).toBe(true);
  });
});

describe("la cadence hebdomadaire", () => {
  const LUNDI = Date.parse("2026-08-03T07:00:00Z");

  it("envoie à quelqu'un qui n'a jamais rien reçu", () => {
    expect(doitEnvoyer(null, LUNDI)).toBe(true);
  });

  it("n'envoie pas deux fois le même jour", () => {
    // C'est la garantie d'idempotence côté données : un rejeu du balayage — une
    // reprise après incident — ne doit pas produire un second e-mail.
    expect(doitEnvoyer("2026-08-03T07:00:00Z", LUNDI)).toBe(false);
  });

  it("envoie une semaine plus tard", () => {
    expect(doitEnvoyer("2026-07-27T07:00:00Z", LUNDI)).toBe(true);
  });

  it("tolère un lundi qui tombe quelques minutes plus tôt", () => {
    // Une exécution planifiée ne tombe jamais à la seconde près. Sans marge,
    // un déclenchement à 7h59 après un 8h01 sauterait une semaine entière, et
    // personne ne comprendrait pourquoi.
    const presqueUneSemaine = LUNDI - 6.9 * 24 * 60 * 60 * 1000;
    expect(doitEnvoyer(new Date(presqueUneSemaine).toISOString(), LUNDI)).toBe(
      true,
    );
  });

  it("ne bloque personne pour toujours sur une date illisible", () => {
    expect(doitEnvoyer("pas une date", LUNDI)).toBe(true);
  });
});
