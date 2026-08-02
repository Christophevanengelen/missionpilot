import { describe, expect, it } from "vitest";
import {
  CIBLE,
  estMotif,
  MOTIFS,
  reglageEnCause,
  SEUIL_DIAGNOSTIC,
  totalEcarte,
  type Comptes,
} from "@/lib/ecartement/motifs";

/**
 * Le diagnostic tiré des écartements.
 *
 * Ces tests protègent contre une seule faute, et elle est de jugement, pas de
 * code : CONCLURE TROP TÔT. Annoncer « votre zone est mal réglée » sur un clic
 * isolé décrédibilise le produit exactement au moment où il prétend écouter.
 */

describe("le vocabulaire est fermé, et il le reste", () => {
  it("refuse tout ce qui n'est pas un motif connu", () => {
    // Le champ libre est la porte par laquelle du texte de parcours finirait
    // dans la seule table du produit qui n'en veut aucun.
    expect(estMotif("wrong_role")).toBe(true);
    expect(estMotif("je cherche autre chose")).toBe(false);
    expect(estMotif("")).toBe(false);
    expect(estMotif(null)).toBe(false);
    expect(estMotif(42)).toBe(false);
  });

  it("donne à chaque motif un réglage à corriger — aucun n'est un ressenti", () => {
    // Le critère d'admission dans la liste : un motif doit désigner une partie
    // du moteur. « Pas intéressant » n'en désigne aucune, il n'y est pas.
    for (const motif of MOTIFS) {
      expect(CIBLE[motif]).toBeDefined();
    }
    expect(Object.keys(CIBLE)).toHaveLength(MOTIFS.length);
  });
});

describe("on ne conclut pas d'un clic", () => {
  it("ne diagnostique rien sous le seuil", () => {
    expect(reglageEnCause({ wrong_place: SEUIL_DIAGNOSTIC - 1 })).toBeNull();
  });

  it("diagnostique dès que le seuil est atteint", () => {
    expect(reglageEnCause({ wrong_place: SEUIL_DIAGNOSTIC })).toEqual({
      cible: "zone",
      total: SEUIL_DIAGNOSTIC,
    });
  });

  it("ne rend rien du tout quand rien n'a été écarté", () => {
    expect(reglageEnCause({})).toBeNull();
    expect(reglageEnCause({ too_junior: 0 })).toBeNull();
  });

  it("refuse de trancher une égalité plutôt que d'inventer un gagnant", () => {
    // Deux réglages à égalité ne désignent rien. Prendre le premier de la
    // liste donnerait une réponse stable, confiante — et arbitraire.
    const partage: Comptes = { wrong_role: 4, wrong_place: 4 };
    expect(reglageEnCause(partage)).toBeNull();
  });
});

describe("les motifs se regroupent par réglage, pas par libellé", () => {
  it("additionne « trop junior » et « trop senior » sur le même réglage", () => {
    // Ce sont deux erreurs opposées, mais elles accusent la MÊME chose : le
    // niveau visé. Les compter séparément laisserait le vrai coupable sous le
    // seuil alors qu'il est cité six fois.
    const comptes: Comptes = { too_junior: 3, too_senior: 3 };
    expect(reglageEnCause(comptes)).toEqual({ cible: "niveau", total: 6 });
  });

  it("désigne le réglage le plus cité quand plusieurs le sont", () => {
    const comptes: Comptes = {
      too_junior: 5,
      wrong_place: 2,
      wrong_contract: 1,
    };
    expect(reglageEnCause(comptes)).toEqual({ cible: "niveau", total: 5 });
  });
});

describe("le total", () => {
  it("additionne tous les motifs, absents compris", () => {
    expect(totalEcarte({ wrong_role: 2, too_senior: 1 })).toBe(3);
    expect(totalEcarte({})).toBe(0);
  });
});
