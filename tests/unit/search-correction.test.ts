import { describe, expect, it } from "vitest";
import {
  AUCUNE_CORRECTION,
  correctionDepuisEcartements,
  signatureEcartements,
} from "@/lib/search/correction";
import { SEUIL_DIAGNOSTIC } from "@/lib/ecartement/motifs";

/**
 * La boucle qui rend « pas pour moi » utile à celui qui clique.
 *
 * Sans elle, les motifs ne serviraient qu'au tableau de pilotage : utile au
 * propriétaire, décoratif pour la personne. Ces tests protègent la prudence de
 * la correction — bouger sur du bruit serait pire que ne pas bouger.
 */

const S = SEUIL_DIAGNOSTIC;

describe("on ne corrige pas sur du bruit", () => {
  it("ne bouge pas sous le seuil", () => {
    expect(correctionDepuisEcartements({ too_junior: S - 1 })).toEqual(
      AUCUNE_CORRECTION,
    );
  });

  it("ne bouge pas quand il n'y a rien", () => {
    expect(correctionDepuisEcartements({})).toEqual(AUCUNE_CORRECTION);
  });

  it("N'ANNULE PAS le niveau quand les deux sens s'équilibrent", () => {
    // « Trois fois trop junior ET trois fois trop senior » ne dit pas où
    // viser : ça dit que le niveau n'est pas le problème. Bouger quand même
    // serait suivre du bruit — et dans une direction tirée au sort.
    const c = correctionDepuisEcartements({ too_junior: S, too_senior: S });
    expect(c.viserPlusHaut).toBe(false);
    expect(c.viserPlusBas).toBe(false);
  });
});

describe("le niveau se corrige dans le sens majoritaire", () => {
  it("vise plus haut après assez de « trop junior »", () => {
    const c = correctionDepuisEcartements({ too_junior: S });
    expect(c.viserPlusHaut).toBe(true);
    expect(c.viserPlusBas).toBe(false);
  });

  it("vise plus bas après assez de « trop senior »", () => {
    const c = correctionDepuisEcartements({ too_senior: S });
    expect(c.viserPlusBas).toBe(true);
    expect(c.viserPlusHaut).toBe(false);
  });

  it("tranche pour la majorité quand les deux dépassent le seuil", () => {
    const c = correctionDepuisEcartements({
      too_junior: S + 2,
      too_senior: S,
    });
    expect(c.viserPlusHaut).toBe(true);
    expect(c.viserPlusBas).toBe(false);
  });
});

describe("les mots qui ont échoué sont nommés, sans qu'une offre soit stockée", () => {
  it("rend les intitulés déjà cherchés quand le métier est en cause", () => {
    // C'est le point qui rend la boucle possible sous la promesse « aucune
    // offre stockée » : le plan PRÉCÉDENT porte ses propres intitulés. Croisés
    // avec « pas le bon métier », ils disent « ces mots-là n'ont pas marché »
    // sans qu'aucune annonce n'ait été conservée.
    const c = correctionDepuisEcartements({ wrong_role: S }, [
      "Product Designer",
      "Design Lead",
    ]);
    expect(c.intitulesEnEchec).toEqual(["Product Designer", "Design Lead"]);
  });

  it("ne prive le modèle d'aucun mot tant que le seuil n'est pas atteint", () => {
    const c = correctionDepuisEcartements({ wrong_role: S - 1 }, ["A", "B"]);
    expect(c.intitulesEnEchec).toEqual([]);
  });

  it("dédoublonne et nettoie, et borne la liste", () => {
    // Une liste qui grandit sans fin finirait par décrire un profil « en
    // creux » plutôt qu'en positif, et par peser plus que le dossier.
    const brut = ["  A ", "A", "B", "C", "D", "E", "F", "G", ""];
    const c = correctionDepuisEcartements({ wrong_role: S }, brut);
    expect(c.intitulesEnEchec).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("supporte l'absence d'intitulés précédents", () => {
    expect(
      correctionDepuisEcartements({ wrong_role: S }).intitulesEnEchec,
    ).toEqual([]);
  });
});

describe("la signature déclenche le recalcul", () => {
  it("est vide quand rien n'a été écarté — aucun recalcul inutile", () => {
    expect(signatureEcartements({})).toBe("");
    expect(signatureEcartements({ too_junior: 0 })).toBe("");
  });

  it("change dès qu'un compteur bouge", () => {
    // Sans ça, la correction n'arriverait JAMAIS : le plan n'est recalculé que
    // si l'empreinte change, et écarter une offre ne touche pas au dossier.
    // La personne cliquerait, et rien ne bougerait.
    const avant = signatureEcartements({ too_junior: 2 });
    const apres = signatureEcartements({ too_junior: 3 });
    expect(apres).not.toBe(avant);
  });

  it("est stable quel que soit l'ordre des clés", () => {
    // Une signature instable ferait recalculer un plan identique à chaque
    // visite — trois appels de modèle pour rien.
    const a = signatureEcartements({ too_junior: 1, wrong_place: 2 });
    const b = signatureEcartements({ wrong_place: 2, too_junior: 1 });
    expect(a).toBe(b);
  });
});
