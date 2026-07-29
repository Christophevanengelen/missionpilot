import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'interrupteur du bouton « Remplir avec LinkedIn ».
 *
 * Ce test existe à cause d'une situation réelle : l'identifiant client et le
 * secret sont posés en production AVANT que LinkedIn n'ait accordé l'accès au
 * produit Member Data Portability, pour que le jour de l'approbation il n'y ait
 * plus qu'une valeur à changer. Pendant toute cette attente, la seule chose qui
 * empêche le bouton d'apparaître est `LINKEDIN_ENABLED`.
 *
 * Si ce garde-fou lâchait, le bouton s'afficherait pour tout le monde et mènerait
 * à un refus de scope de LinkedIn — sur le premier écran du produit, là où ça
 * coûte le plus cher. Aucun test fonctionnel ne le détecterait : tout
 * « marcherait », au sens où le code s'exécuterait.
 */

const envState: Record<string, unknown> = {};
vi.mock("@/lib/env", () => ({ env: envState }));

type Mod = typeof import("@/lib/profile/linkedin-oauth");
let mod: Mod;

/** Un identifiant et un secret présents et valides : le cas dangereux. */
function poserIdentifiants() {
  envState.LINKEDIN_CLIENT_ID = "783myrccwojhmp";
  envState.LINKEDIN_CLIENT_SECRET = "secret-de-test-non-reel";
  envState.NEXT_PUBLIC_APP_URL = "https://missionpilot.net";
}

beforeEach(async () => {
  for (const cle of Object.keys(envState)) delete envState[cle];
  vi.resetModules();
  mod = await import("@/lib/profile/linkedin-oauth");
});

describe("linkedInConfigure", () => {
  it("reste FAUX quand l'identifiant et le secret sont posés mais l'interrupteur est à false", async () => {
    // LA configuration de production pendant l'attente de l'approbation
    // LinkedIn. C'est exactement ici que le produit se joue sa crédibilité.
    poserIdentifiants();
    envState.LINKEDIN_ENABLED = false;
    expect(mod.linkedInConfigure()).toBe(false);
  });

  it("reste FAUX quand l'interrupteur est absent", async () => {
    // `env.ts` transforme toute valeur autre que "true"/"1" en `false`, donc une
    // variable jamais posée arrive ici en `false` — pas en `undefined`. Le test
    // couvre quand même le cas, car cette transformation pourrait changer.
    poserIdentifiants();
    expect(mod.linkedInConfigure()).toBe(false);
  });

  it("n'accepte pas une chaîne « true » — seul le booléen compte", async () => {
    // La conversion appartient à `env.ts`. Si elle disparaissait, une chaîne
    // non vide serait « vraie » par mégarde et allumerait le bouton.
    poserIdentifiants();
    envState.LINKEDIN_ENABLED = "true";
    expect(mod.linkedInConfigure()).toBe(false);
  });

  it("reste FAUX si le secret manque, même interrupteur allumé", async () => {
    // Sans secret, l'échange code → jeton échouerait au retour de LinkedIn :
    // la personne aurait autorisé le partage pour rien.
    poserIdentifiants();
    envState.LINKEDIN_CLIENT_SECRET = undefined;
    envState.LINKEDIN_ENABLED = true;
    expect(mod.linkedInConfigure()).toBe(false);
  });

  it("reste FAUX si l'identifiant manque, même interrupteur allumé", async () => {
    poserIdentifiants();
    envState.LINKEDIN_CLIENT_ID = undefined;
    envState.LINKEDIN_ENABLED = true;
    expect(mod.linkedInConfigure()).toBe(false);
  });

  it("n'est VRAI que lorsque les trois sont réunis", async () => {
    poserIdentifiants();
    envState.LINKEDIN_ENABLED = true;
    expect(mod.linkedInConfigure()).toBe(true);
  });
});

describe("adresseRetour", () => {
  it("est exactement l'URL déclarée dans l'app LinkedIn", async () => {
    // Une URL de retour qui ne correspond pas AU CARACTÈRE PRÈS à celle
    // enregistrée dans le portail fait échouer l'autorisation, avec un message
    // que LinkedIn n'explique pas. Celle-ci est enregistrée depuis le
    // 2026-07-29.
    envState.NEXT_PUBLIC_APP_URL = "https://missionpilot.net";
    expect(mod.adresseRetour()).toBe(
      "https://missionpilot.net/api/linkedin/callback",
    );
  });
});

describe("urlAutorisation", () => {
  it("porte le scope 3rd-party et l'état, et rien d'autre de sensible", async () => {
    const url = new URL(
      mod.urlAutorisation({
        clientId: "783myrccwojhmp",
        redirectUri: "https://missionpilot.net/api/linkedin/callback",
        etat: "etat-de-test",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("r_dma_portability_3rd_party");
    expect(url.searchParams.get("state")).toBe("etat-de-test");
    expect(url.searchParams.get("response_type")).toBe("code");
    // Le secret client n'a RIEN à faire dans une URL : elle passe par le
    // navigateur, l'historique et les journaux de LinkedIn.
    expect(url.search).not.toMatch(/secret/i);
  });
});
