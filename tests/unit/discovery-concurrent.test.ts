import { describe, expect, it } from "vitest";
import {
  runMultiSourceDiscovery,
  type DiscoverySource,
  type SearchPlan,
} from "@/lib/discovery/plan";

type Ad = { sourceUrl: string | null; rawText: string };

const plan = (kw: string): SearchPlan => ({
  keywords: [kw],
  mode: "title" as const,
});
const ad = (url: string): Ad => ({ sourceUrl: url, rawText: url });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("discovery runs searches concurrently", () => {
  it("costs the SLOWEST search, not the sum of them", async () => {
    // The reason this matters: one real source answers in about twenty
    // seconds. Sequentially, a dozen plans put the first visit beyond anyone's
    // patience — and it silently capped the product, because adding a source
    // or a country meant adding minutes.
    const slow = (name: string): DiscoverySource<Ad> => ({
      name,
      search: async (keywords) => {
        await wait(60);
        return [ad(`https://${name}/${keywords[0]}`)];
      },
    });

    const started = Date.now();
    const { items } = await runMultiSourceDiscovery(
      [plan("a"), plan("b"), plan("c")],
      [slow("S1"), slow("S2")],
      () => {},
    );
    const elapsed = Date.now() - started;

    expect(items).toHaveLength(6);
    // Six searches of 60 ms each: sequential would be ~360 ms. Generous bound
    // so the assertion measures concurrency, not the machine.
    expect(elapsed).toBeLessThan(250);
  });

  it("keeps a deterministic order whatever the response times", async () => {
    // THE PROPERTY THAT MATTERS. Deduplication walks the outcomes in the
    // caller's source order, never in arrival order — otherwise which of two
    // identical ads survives would depend on network timing, and a list that
    // reshuffles between two identical searches is one nobody can trust.
    const fast: DiscoverySource<Ad> = {
      name: "Fast",
      search: async () => [ad("https://shared/offer"), ad("https://fast/1")],
    };
    const slow: DiscoverySource<Ad> = {
      name: "Slow",
      search: async () => {
        await wait(40);
        return [ad("https://shared/offer"), ad("https://slow/1")];
      },
    };

    // Slow is declared FIRST, so it must own the shared ad even though its
    // response arrives last.
    const run = await runMultiSourceDiscovery(
      [plan("x")],
      [slow, fast],
      () => {},
    );
    expect(run.items.map((i) => [i.ad.sourceUrl, i.sourceName])).toEqual([
      ["https://shared/offer", "Slow"],
      ["https://slow/1", "Slow"],
      ["https://fast/1", "Fast"],
    ]);

    // And the same run twice gives the same list, byte for byte.
    const again = await runMultiSourceDiscovery(
      [plan("x")],
      [slow, fast],
      () => {},
    );
    expect(again.items.map((i) => i.ad.sourceUrl)).toEqual(
      run.items.map((i) => i.ad.sourceUrl),
    );
  });

  it("n'interroge QU'UNE FOIS une source qui ignore les mots-clés", async () => {
    // Remote OK et Recruitee n'exposent aucun filtre : leur réponse est la même
    // pour les douze intitulés d'un plan. Les rejouer par plan, c'est
    // télécharger douze fois le même tableau d'affichage — ce que les journaux
    // de production du 2026-07-29 montrent noir sur blanc : six appels Remote
    // OK et les mêmes locataires Recruitee reparsés six fois sur UN rendu.
    let appels = 0;
    const flux: DiscoverySource<Ad> = {
      name: "Flux",
      search: async () => {
        appels += 1;
        return [ad("https://flux/1")];
      },
      ignoresKeywords: true,
    };
    const parMot: DiscoverySource<Ad> = {
      name: "ParMot",
      search: async (keywords) => [ad(`https://parmot/${keywords[0]}`)],
    };

    const run = await runMultiSourceDiscovery(
      [plan("a"), plan("b"), plan("c"), plan("d")],
      [flux, parMot],
      () => {},
    );

    expect(appels).toBe(1);
    // Quatre plans : une recherche pour le flux, quatre pour l'autre.
    expect(run.totalSearches).toBe(5);
    expect(run.items).toHaveLength(5);
  });

  it("compte les échecs sur ce qu'une source a VRAIMENT tenté", async () => {
    // Sinon une source qui ignore les mots-clés et tombe une fois s'annonce
    // « 1 échec sur 4 » — un dénominateur inventé, qui donne à croire que trois
    // recherches ont abouti alors qu'aucune n'a eu lieu.
    const casse: DiscoverySource<Ad> = {
      name: "Cassé",
      search: async () => {
        throw new Error("503");
      },
      ignoresKeywords: true,
    };

    const run = await runMultiSourceDiscovery(
      [plan("a"), plan("b"), plan("c")],
      [casse],
      () => {},
    );

    expect(run.failedSources).toEqual([{ name: "Cassé", failed: 1, total: 1 }]);
    expect(run.totalSearches).toBe(1);
  });

  it("lets one failing search cost only its own results", async () => {
    const broken: DiscoverySource<Ad> = {
      name: "Broken",
      search: async () => {
        throw new Error("429");
      },
    };
    const fine: DiscoverySource<Ad> = {
      name: "Fine",
      search: async () => [ad("https://fine/1")],
    };

    const errors: string[] = [];
    const run = await runMultiSourceDiscovery(
      [plan("x"), plan("y")],
      [broken, fine],
      (name) => errors.push(name),
    );

    expect(run.items).toHaveLength(1);
    expect(run.failedSearches).toBe(2);
    expect(run.totalSearches).toBe(4);
    expect(errors).toEqual(["Broken", "Broken"]);
    expect(run.failedSources).toEqual([
      { name: "Broken", failed: 2, total: 2 },
    ]);
  });
});
