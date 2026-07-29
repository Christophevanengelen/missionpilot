import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { lancerParSource, MAX_CONCURRENT_SEARCHES } =
  await import("@/lib/discovery/par-source");

/**
 * Le découpage par source, et les deux garanties qu'il ne doit pas perdre.
 *
 * 1. LA BORNE. Six recherches simultanées AU TOTAL. Une promesse par source
 *    invite à l'erreur qui a coûté cher le 2026-07-29 : croire que des cibles
 *    distinctes autorisent à multiplier le fan-out. Recruitee a répondu HTTP
 *    429 sur dix-neuf tenants et l'écran n'affichait plus aucune offre.
 *
 * 2. L'ORDRE. Deux recherches identiques doivent rendre la même liste. Si
 *    l'ordre suivait celui des réponses, la déduplication en aval changerait de
 *    gagnant d'une visite à l'autre — une liste qui se réordonne toute seule
 *    est une liste à laquelle personne ne se fie.
 */

type Ad = { sourceUrl: string | null; rawText: string };

const plan = (mot: string) => ({ keywords: [mot], mode: "title" as const });

/**
 * Le compteur est PARTAGÉ entre toutes les sources d'un test.
 *
 * Première version de ce fichier : chaque espion tenait son propre maximum et
 * le test les additionnait. C'était faux — deux maxima n'ont aucune raison de
 * se produire au même instant, et la somme accusait la borne d'être dépassée
 * alors qu'elle tenait. Mesurer une simultanéité GLOBALE demande un compteur
 * global, pas une somme de mesures locales.
 */
function creerCompteur() {
  return { simultanesMax: 0, enCours: 0, appels: 0 };
}

type Compteur = ReturnType<typeof creerCompteur>;

function sourceEspion(
  nom: string,
  options: { delaiMs?: number; echoue?: boolean; compteur?: Compteur } = {},
) {
  const etat = options.compteur ?? creerCompteur();
  return {
    etat,
    source: {
      name: nom,
      async search(keywords: string[]): Promise<Ad[]> {
        etat.appels += 1;
        etat.enCours += 1;
        etat.simultanesMax = Math.max(etat.simultanesMax, etat.enCours);
        try {
          if (options.delaiMs) {
            await new Promise((r) => setTimeout(r, options.delaiMs));
          }
          if (options.echoue) throw new Error(`${nom} en panne`);
          return [
            {
              sourceUrl: `https://${nom}/${keywords[0]}`,
              rawText: keywords[0],
            },
          ];
        } finally {
          etat.enCours -= 1;
        }
      },
    },
  };
}

describe("la borne de concurrence est GLOBALE", () => {
  it("ne dépasse jamais six recherches simultanées, toutes sources confondues", async () => {
    // Cinq sources × trois plans = quinze recherches. Si la borne était par
    // source, on verrait quinze appels simultanés.
    const compteur = creerCompteur();
    const espions = [1, 2, 3, 4, 5].map((n) =>
      sourceEspion(`S${n}`, { delaiMs: 30, compteur }),
    );
    const plans = [plan("a"), plan("b"), plan("c")];

    const lancements = lancerParSource(
      plans,
      espions.map((e) => e.source),
      () => {},
    );
    await Promise.all(lancements.map((l) => l.promesse));

    expect(compteur.simultanesMax).toBeLessThanOrEqual(MAX_CONCURRENT_SEARCHES);
    // Et tout le travail a bien été fait, pas seulement borné.
    expect(compteur.appels).toBe(15);
    // La borne doit être ATTEINTE, sinon le test passerait aussi avec un
    // limiteur qui sérialise tout — et on aurait « corrigé » la latence en
    // la multipliant.
    expect(compteur.simultanesMax).toBe(MAX_CONCURRENT_SEARCHES);
  });

  it("garde la borne à six — la remonter est ce qui nous a fait limiter", () => {
    expect(MAX_CONCURRENT_SEARCHES).toBeLessThanOrEqual(6);
  });
});

describe("l'ordre ne dépend pas de qui répond le plus vite", () => {
  it("rend les sources dans l'ordre reçu, pas dans l'ordre d'arrivée", async () => {
    // La lente est déclarée en premier : son résultat doit rester en premier.
    const lente = sourceEspion("Lente", { delaiMs: 60 });
    const rapide = sourceEspion("Rapide");

    const lancements = lancerParSource(
      [plan("x")],
      [lente.source, rapide.source],
      () => {},
    );
    expect(lancements.map((l) => l.nom)).toEqual(["Lente", "Rapide"]);

    const resultats = await Promise.all(lancements.map((l) => l.promesse));
    expect(resultats.map((r) => r.nom)).toEqual(["Lente", "Rapide"]);
  });

  it("garde les annonces d'une source dans l'ordre de ses plans", async () => {
    const s = sourceEspion("S");
    const [{ promesse }] = lancerParSource(
      [plan("premier"), plan("second"), plan("troisieme")],
      [s.source],
      () => {},
    );
    const r = await promesse;
    expect(r.ads.map((a) => a.rawText)).toEqual([
      "premier",
      "second",
      "troisieme",
    ]);
  });
});

describe("une source en panne n'emporte pas les autres", () => {
  it("ne rejette JAMAIS — elle compte ses échecs", async () => {
    // Une promesse rejetée ferait tomber la frontière Suspense qui l'attend, et
    // une plateforme morte effacerait l'écran des autres.
    const morte = sourceEspion("Morte", { echoue: true });
    const vivante = sourceEspion("Vivante");

    const lancements = lancerParSource(
      [plan("a"), plan("b")],
      [morte.source, vivante.source],
      () => {},
    );
    const [rMorte, rVivante] = await Promise.all(
      lancements.map((l) => l.promesse),
    );

    expect(rMorte.echecs).toBe(2);
    expect(rMorte.tentatives).toBe(2);
    expect(rMorte.ads).toEqual([]);
    // La vivante n'a rien perdu.
    expect(rVivante.echecs).toBe(0);
    expect(rVivante.ads).toHaveLength(2);
  });

  it("signale chaque échec à l'appelant, avec le nom de la source", async () => {
    const vus: string[] = [];
    const morte = sourceEspion("Morte", { echoue: true });
    const [{ promesse }] = lancerParSource([plan("a")], [morte.source], (nom) =>
      vus.push(nom),
    );
    await promesse;
    expect(vus).toEqual(["Morte"]);
  });

  it("porte un dénominateur, pas seulement un compte d'échecs", async () => {
    // « 3 échecs » ne veut rien dire seul : sur trois tentatives c'est une
    // source morte, sur trente c'est un incident.
    const s = sourceEspion("S", { echoue: true });
    const [{ promesse }] = lancerParSource(
      [plan("a"), plan("b"), plan("c")],
      [s.source],
      () => {},
    );
    const r = await promesse;
    expect(r.tentatives).toBe(3);
  });
});

describe("le travail démarre pour tout le monde en même temps", () => {
  it("attendre la première promesse ne retarde pas les suivantes", async () => {
    // C'est ce qui distingue « afficher au fil de l'eau » de « afficher dans
    // l'ordre où on a demandé ». Si les sources ne démarraient qu'à
    // l'attente, la deuxième ne commencerait qu'après la première.
    const a = sourceEspion("A", { delaiMs: 40 });
    const b = sourceEspion("B", { delaiMs: 40 });

    const lancements = lancerParSource(
      [plan("x")],
      [a.source, b.source],
      () => {},
    );
    // Aucune attente encore — les deux sources doivent déjà avoir été appelées.
    await new Promise((r) => setTimeout(r, 10));
    expect(a.etat.appels).toBe(1);
    expect(b.etat.appels).toBe(1);

    await Promise.all(lancements.map((l) => l.promesse));
  });
});

describe("une source sans filtre n'est interrogée qu'une fois", () => {
  it("ne rejoue pas le même téléchargement une fois par plan", async () => {
    // LE PIÈGE QUE CE TEST FERME. Le correctif de la panne du 2026-07-29 avait
    // posé cette règle dans `runMultiSourceDiscovery`… qui n'est PAS le chemin
    // emprunté par cet écran. Restaurer la barre de progression réintroduisait
    // donc à elle seule les téléchargements répétés qu'on venait de supprimer :
    // six appels Remote OK et les mêmes locataires Recruitee reparsés six fois,
    // exactement ce que montraient les journaux de production.
    let appels = 0;
    const flux = {
      name: "Flux",
      search: async () => {
        appels += 1;
        return [{ sourceUrl: "https://flux/1", rawText: "1" }] as Ad[];
      },
      ignoresKeywords: true,
    };

    const [lancement] = lancerParSource<Ad>(
      [plan("a"), plan("b"), plan("c"), plan("d")],
      [flux],
      () => {},
    );
    const r = await lancement.promesse;

    expect(appels).toBe(1);
    // Et le dénominateur suit : annoncer « 0 sur 4 » à une source interrogée
    // une seule fois laisserait croire que trois recherches ont abouti.
    expect(r.tentatives).toBe(1);
    expect(r.ads).toHaveLength(1);
  });

  it("laisse les sources filtrantes rejouer tous les plans", async () => {
    const parMot = {
      name: "ParMot",
      search: async (keywords: string[]) =>
        [
          { sourceUrl: `https://x/${keywords[0]}`, rawText: keywords[0] },
        ] as Ad[],
    };

    const [lancement] = lancerParSource<Ad>(
      [plan("a"), plan("b"), plan("c")],
      [parMot],
      () => {},
    );
    const r = await lancement.promesse;

    expect(r.tentatives).toBe(3);
    expect(r.ads.map((a) => a.sourceUrl)).toEqual([
      "https://x/a",
      "https://x/b",
      "https://x/c",
    ]);
  });
});
