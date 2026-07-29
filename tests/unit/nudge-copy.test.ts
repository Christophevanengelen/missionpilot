import { describe, expect, it } from "vitest";
import { t, type Locale } from "@/lib/copy";

/**
 * « Aucun palier décoratif. »
 *
 * Règle produit arrêtée le 2026-07-26 : jamais de pourcentage nu ; un palier se
 * lit en CAPACITÉ GAGNÉE, et chaque capacité annoncée doit être adossée à une
 * porte réelle du code.
 *
 * Le tableau de bord la violait — il affichait « Profil à 62 % » — et personne
 * ne l'avait vu, parce qu'un pourcentage ne casse rien : il s'affiche
 * parfaitement, il informe simplement de la mauvaise chose. C'est le mode de
 * défaillance que la règle elle-même décrit : « je ne l'ai vu qu'en regardant
 * la capture d'écran de l'écran réel, pas en relisant le code ».
 *
 * Les deux locales sont tenues au même contrat : un miroir qui dérive, c'est
 * une règle d'honnêteté qui cesse de s'appliquer à la moitié des gens.
 */
const LOCALES: Locale[] = ["fr", "en"];

/** Les dimensions que `nextStep` peut rendre — cf. `lib/profile/readiness`. */
const DIMENSIONS = ["identity", "skills", "scope", "trajectory", "proof"];

describe.each(LOCALES)("le rappel de profil — %s", (locale) => {
  const copy = t(locale).home;

  it("n'affiche JAMAIS de pourcentage", () => {
    for (const dimension of DIMENSIONS) {
      const phrase = copy.nudge(dimension, "votre métier");
      expect(phrase).not.toMatch(/\d\s*%/);
      // Ni le mot, ni le symbole : « profil à 62 pour cent » serait le même
      // défaut habillé autrement.
      expect(phrase.toLowerCase()).not.toContain("pour cent");
      expect(phrase.toLowerCase()).not.toContain("percent");
    }
  });

  it("nomme ce que la réponse OUVRE, et reprend la demande", () => {
    for (const dimension of DIMENSIONS) {
      const phrase = copy.nudge(dimension, "votre métier");
      // La demande est citée : un rappel qui ne dit pas ce qu'il réclame
      // renvoie la personne chercher elle-même ce qui manque.
      expect(phrase).toContain("votre métier");
      expect(phrase.length).toBeGreaterThan(30);
    }
  });

  it("distingue les dimensions au lieu de servir une phrase passe-partout", () => {
    // Si toutes les dimensions rendaient le même texte, la règle serait
    // respectée à la lettre et vide en pratique : « capacité gagnée » suppose
    // que la capacité dépende de ce qu'on demande.
    const phrases = new Set(
      DIMENSIONS.map((d) => copy.nudge(d, "votre métier")),
    );
    expect(phrases.size).toBeGreaterThan(1);
  });

  it("reste utilisable si une dimension inconnue apparaît", () => {
    // Ajouter une dimension dans `readiness` ne doit pas produire un écran
    // vide : le repli est générique, mais il est une phrase.
    const phrase = copy.nudge("une-dimension-future", "votre métier");
    expect(phrase).toContain("votre métier");
    expect(phrase).not.toMatch(/\d\s*%/);
  });
});
