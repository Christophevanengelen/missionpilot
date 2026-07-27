import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { copy } from "@/lib/copy";
import { CONSIGNE_ART9 } from "@/lib/profile/cv-ai";

/**
 * Le consentement de l'article 9 se vérifie à deux endroits, et le second
 * compte plus que le premier.
 *
 * Une case cochée sans mesure technique derrière n'est pas une protection,
 * c'est une décharge : on ferait signer quelqu'un pour un risque qu'on ne
 * réduit pas. Ces tests lisent donc le PROMPT réellement envoyé, pas une
 * intention écrite dans un commentaire.
 */

/* On teste la VALEUR de la consigne, pas le texte du fichier : dans la source
   elle est découpée en concaténations, donc « origine raciale » y chevauche
   deux lignes et n'y apparaît jamais d'un seul tenant. Ce qui compte est ce qui
   part au modèle, une fois assemblé. Le fichier n'est lu que pour les versions
   de prompt, qui sont bien des littéraux. */
const cvAi = readFileSync(
  join(process.cwd(), "src/lib/profile/cv-ai.ts"),
  "utf8",
);

describe("la consigne envoyée au modèle", () => {
  it("nomme les catégories de l'art. 9(1), sans en oublier", () => {
    // Chacune est une catégorie que le RGPD interdit de traiter par principe.
    // Une absence ici ne casse aucun test fonctionnel — d'où celui-ci.
    for (const categorie of [
      "santé",
      "handicap",
      "grossesse",
      "origine raciale",
      "nationalité",
      "opinions politiques",
      "convictions religieuses",
      "appartenance syndicale",
      "orientation sexuelle",
      "biométriques",
      "génétiques",
      "condamnations pénales",
    ]) {
      expect(CONSIGNE_ART9).toContain(categorie);
    }
  });

  it("interdit AUSSI la reformulation, pas seulement l'extraction", () => {
    // « N'extrais pas » laisserait le modèle libre de reformuler une mention
    // en la conservant : « disponible après une longue convalescence ».
    expect(CONSIGNE_ART9).toMatch(/N'EXTRAIS ET NE REFORMULE JAMAIS/);
  });

  it("interdit de donner le motif d'une interruption de carrière", () => {
    // Le cas le plus fréquent, et le plus discret : un trou dans un CV que le
    // modèle « explique » utilement.
    // `[\s\S]` plutôt que le drapeau `s` : la cible TypeScript du dépôt est
    // antérieure à es2018, où `dotAll` n'existe pas.
    expect(CONSIGNE_ART9).toMatch(
      /interruption de carrière[\s\S]*jamais le motif/,
    );
  });

  it("est attachée aux DEUX prompts, pas seulement au plus visible", () => {
    // L'analyse profonde et l'extraction de compétences envoient toutes deux
    // le CV intégral. En protéger une seule ne protège rien.
    const occurrences = cvAi.split("CONSIGNE_ART9").length - 1;
    // 1 déclaration + 2 usages.
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("a fait incrémenter les versions de prompt", () => {
    // Les traces d'exécution doivent distinguer l'avant de l'après : sans ça,
    // impossible de dire quelles analyses ont bénéficié de la consigne.
    expect(cvAi).toContain('CV_SKILLS_PROMPT_VERSION = "cv-skills-2"');
    expect(cvAi).toContain('CV_PROFILE_PROMPT_VERSION = "cv-profile-2"');
  });
});

describe("la copie de l'écran de dépôt", () => {
  const art9 = copy.fr.cvImport.art9;

  it("ne promet PAS de garantie", () => {
    // Un modèle n'obéit pas comme une clause `where`. Promettre l'inverse
    // serait exactement le genre d'affirmation que ce produit s'interdit.
    expect(art9.mesure).toMatch(/ne pouvons pas vous le garantir/i);
  });

  it("recommande le geste qui ne dépend pas de nous", () => {
    // La meilleure protection reste celle que la personne applique elle-même.
    expect(art9.mesure).toMatch(/retirer.*de votre CV/i);
  });

  it("explique ce qu'est une donnée sensible par des exemples, pas par le mot", () => {
    // « Donnée sensible au sens de l'article 9 » ne dit rien à personne.
    expect(art9.detail).toMatch(/santé|syndical|nationalité/);
    expect(art9.detail).not.toMatch(/article 9|art\. 9/i);
  });

  it("le refus n'invite pas à réessayer — ce n'est pas une panne", () => {
    expect(copy.fr.cvImport.errors.consent).not.toMatch(/réessayez/i);
    expect(copy.fr.cvImport.errors.consent).toMatch(/cochez/i);
  });
});
