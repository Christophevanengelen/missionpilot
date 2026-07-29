import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import {
  estAlerte,
  lireDepots,
  lireMotif,
  MOTIFS,
  TON,
} from "@/lib/profile/linkedin-retour";

/**
 * Le retour de LinkedIn est le seul endroit du produit où l'information part
 * dans une URL, quitte le site, et doit être retrouvée au retour. Deux choses
 * peuvent se désaccorder en silence, et aucune ne casse un test fonctionnel :
 *
 * 1. le gestionnaire de retour émet un motif que la page ne sait pas lire —
 *    l'écran redevient muet, exactement le défaut qu'on vient de corriger ;
 * 2. un motif existe mais n'a pas de message dans une des deux langues.
 *
 * D'où des tests qui partent de la LISTE des motifs et vérifient que tout le
 * reste la couvre, plutôt que d'énumérer des cas à la main.
 */

describe("lireMotif", () => {
  it("accepte exactement les motifs émis par le gestionnaire de retour", () => {
    for (const motif of MOTIFS) expect(lireMotif(motif)).toBe(motif);
  });

  it("n'affiche RIEN sur une valeur inventée", () => {
    // Une URL bricolée à la main ne doit pas pouvoir faire dire au produit
    // qu'un import a réussi.
    expect(lireMotif("ok!")).toBeNull();
    expect(lireMotif("succès")).toBeNull();
    expect(lireMotif("")).toBeNull();
    expect(lireMotif(undefined)).toBeNull();
  });

  it("refuse un paramètre répété plutôt que d'en deviner un", () => {
    // `?linkedin=ok&linkedin=echec` arrive en tableau : l'intention n'est pas
    // devinable, et en choisir un affichrait peut-être l'inverse de la vérité.
    expect(lireMotif(["ok", "echec"])).toBeNull();
    expect(lireMotif(["ok"])).toBeNull();
  });
});

describe("lireDepots", () => {
  it("lit un compte plausible", () => {
    expect(lireDepots("12")).toBe(12);
    expect(lireDepots("1")).toBe(1);
  });

  it("rend null sur tout ce qui n'est pas un compte utile", () => {
    // `null` fait basculer sur la phrase sans chiffre. Un `NaN` ou un zéro
    // produirait « 0 affirmations vous attendent », qui contredirait le motif
    // « ok » lui-même.
    expect(lireDepots("0")).toBeNull();
    expect(lireDepots("-3")).toBeNull();
    expect(lireDepots("3.5")).toBeNull();
    expect(lireDepots("beaucoup")).toBeNull();
    expect(lireDepots("99999")).toBeNull();
    expect(lireDepots(undefined)).toBeNull();
    expect(lireDepots(["4"])).toBeNull();
  });
});

describe("les tons", () => {
  it("couvre chaque motif", () => {
    for (const motif of MOTIFS) expect(TON[motif]).toBeTruthy();
  });

  it("ne traite PAS un refus comme un incident", () => {
    // Refuser était une des deux réponses proposées par LinkedIn. L'afficher
    // en rouge reprocherait à quelqu'un d'avoir exercé son choix.
    expect(TON.annule).toBe("neutre");
    expect(estAlerte("annule")).toBe(false);
  });

  it("alerte quand la personne doit agir ou savoir", () => {
    expect(estAlerte("echec")).toBe(true);
    expect(estAlerte("etat-invalide")).toBe(true);
  });

  it("ne confond pas une réponse vide avec une panne", () => {
    // LinkedIn a répondu. Envoyer réessayer serait une boucle sans issue.
    expect(TON.vide).toBe("neutre");
  });
});

describe("les messages", () => {
  for (const [langue, textes] of [
    ["fr", copy.fr.cvImport.linkedinApi.retours],
    ["en", copy.en.cvImport.linkedinApi.retours],
  ] as const) {
    it(`${langue} : chaque motif a un message non vide`, () => {
      for (const motif of MOTIFS) {
        const texte = motif === "ok" ? textes.ok(3) : textes[motif];
        expect(typeof texte).toBe("string");
        expect((texte as string).length).toBeGreaterThan(20);
      }
    });

    it(`${langue} : le succès accorde le singulier`, () => {
      expect(textes.ok(1)).not.toMatch(/\b1 (affirmations|statements)\b/);
      expect(textes.ok(3)).toMatch(/3/);
    });

    it(`${langue} : le refus n'invite pas à réessayer`, () => {
      // Même règle que le refus de consentement sur le dépôt de CV : ce n'est
      // pas une panne, donc pas de « réessayez ».
      expect(textes.annule).not.toMatch(/réessay|try again/i);
    });

    it(`${langue} : le succès dit que rien n'est confirmé`, () => {
      // C'est LA promesse du produit sur ce chemin : le profil ne se remplit
      // pas dans le dos de son propriétaire. Annoncer un import réussi sans le
      // dire laisserait croire que tout est acquis.
      expect(textes.okNote).toMatch(/confirm/i);
    });

    it(`${langue} : l'état invalide dit que rien n'a été importé`, () => {
      // Un message de sécurité qui ne dit pas ce qui est arrivé aux données
      // inquiète sans informer.
      expect(textes["etat-invalide"]).toMatch(
        /rien n'a été importé|Nothing was imported/i,
      );
    });
  }
});
