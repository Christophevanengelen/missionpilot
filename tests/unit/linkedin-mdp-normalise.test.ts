import { describe, expect, it } from "vitest";
import {
  DOMAINES,
  lirePage,
  MDP_VERSION,
  recommandationsRecues,
} from "@/lib/profile/linkedin-mdp-normalise";

/**
 * La charge utile de référence est celle de la documentation LinkedIn, recopiée
 * telle quelle. Elle est le seul exemple officiel de la forme réellement
 * renvoyée, et c'est ce qui rend ces tests utiles plutôt que circulaires : ils
 * éprouvent la lecture contre ce que LinkedIn publie, pas contre ce que j'ai
 * imaginé.
 */
const PAGE_PROFILE = {
  paging: {
    start: 0,
    count: 10,
    links: [
      {
        type: "application/json",
        rel: "next",
        href: "/rest/memberSnapshotData?count=10&domain=PROFILE&q=criteria&start=1",
      },
    ],
    total: 2,
  },
  elements: [
    {
      snapshotData: [
        {
          Websites: "",
          Address: "",
          "Maiden Name": "",
          "Instant Messengers": "",
          "First Name": "Tom",
          "Geo Location": "",
          "Twitter Handles": "",
          Industry: "",
          "Zip Code": "94086",
          Headline: "Marketing Manager at Microsoft, Inc.",
          Summary: "",
          "Birth Date": "",
          "Last Name": "Cruise",
        },
      ],
      snapshotDomain: "PROFILE",
    },
  ],
};

describe("lirePage", () => {
  it("lit l’exemple officiel et minuscule les clés", () => {
    // Le contrat de LinkedInRecords : `field()` cherche en minuscules. Livrer
    // « Headline » tel quel ne lèverait aucune erreur — l'import trouverait
    // zéro champ et réussirait en ne remontant rien.
    const page = lirePage(PAGE_PROFILE);
    expect(page.domaine).toBe("PROFILE");
    expect(page.lignes).toHaveLength(1);
    expect(page.lignes[0].headline).toBe(
      "Marketing Manager at Microsoft, Inc.",
    );
    expect(page.lignes[0]["first name"]).toBe("Tom");
  });

  it("écarte les champs vides au lieu de les stocker comme des valeurs", () => {
    // LinkedIn renvoie une majorité de chaînes vides. Les garder ferait passer
    // « Industry : » pour un secteur déclaré.
    const page = lirePage(PAGE_PROFILE);
    expect(page.lignes[0]).not.toHaveProperty("industry");
    expect(page.lignes[0]).not.toHaveProperty("summary");
  });

  it("remonte les libellés RÉELLEMENT reçus, casse d’origine conservée", () => {
    // Les libellés par domaine ne sont pas documentés. C'est la seule preuve
    // que la lecture a rencontré ce qu'elle croyait lire.
    const page = lirePage(PAGE_PROFILE);
    expect(page.champsVus).toContain("First Name");
    expect(page.champsVus).toContain("Zip Code");
  });

  it("ne compte pas une ligne entièrement vide comme une ligne", () => {
    const page = lirePage({
      elements: [
        { snapshotDomain: "POSITIONS", snapshotData: [{ Title: "" }] },
      ],
    });
    expect(page.lignes).toHaveLength(0);
  });

  it("ramène les nombres et les booléens à du texte, écarte le reste", () => {
    // Les objets et tableaux ne sont pas aplatis : injecter du JSON brut dans
    // un récit de parcours produirait du bruit qu'on lirait comme du parcours.
    const page = lirePage({
      elements: [
        {
          snapshotDomain: "POSITIONS",
          snapshotData: [
            { Année: 2019, Actuel: true, Imbriqué: { a: 1 }, Liste: [1, 2] },
          ],
        },
      ],
    });
    expect(page.lignes[0]["année"]).toBe("2019");
    expect(page.lignes[0]["actuel"]).toBe("true");
    expect(page.lignes[0]).not.toHaveProperty("imbriqué");
    expect(page.lignes[0]).not.toHaveProperty("liste");
  });

  it("survit à une charge utile inattendue sans jeter", () => {
    // La doc se contredit elle-même sur `elements` (tableau dans un exemple,
    // objet dans l'autre). Une page illisible doit coûter cette page, jamais
    // l'import entier.
    expect(lirePage({ elements: {} }).lignes).toEqual([]);
    expect(lirePage(null).lignes).toEqual([]);
    expect(lirePage({ elements: [] }).domaine).toBeNull();
  });
});

describe("recommandationsRecues", () => {
  it("n’importe RIEN quand rien ne dit qui a écrit quoi", () => {
    // Le domaine mélange reçues et écrites, et le discriminant n'est pas
    // documenté. Verser dans le dossier de quelqu'un l'éloge qu'il a rédigé
    // pour un tiers est la faute que ce produit ne peut pas commettre.
    const { gardees, motifSiVide } = recommandationsRecues([
      { text: "Formidable", "first name": "Ada" },
    ]);
    expect(gardees).toEqual([]);
    expect(motifSiVide).toMatch(/reçues ou écrites/);
  });

  it("garde les reçues quand un champ de direction existe", () => {
    const { gardees, motifSiVide } = recommandationsRecues([
      { direction: "RECEIVED", text: "A piloté une équipe de 12" },
      { direction: "GIVEN", text: "Je recommande vivement" },
    ]);
    expect(gardees).toHaveLength(1);
    expect(gardees[0].text).toBe("A piloté une équipe de 12");
    expect(motifSiVide).toBeNull();
  });

  it("ne signale pas un motif quand il n’y avait rien à trier", () => {
    expect(recommandationsRecues([]).motifSiVide).toBeNull();
  });
});

describe("constantes", () => {
  it("épingle la seule version acceptée par le point d’entrée", () => {
    // Toute autre valeur échoue en 426 NONEXISTENT_VERSION. Épinglée ici pour
    // qu'un « on met à jour la version » se heurte à un test.
    expect(MDP_VERSION).toBe("202312");
  });

  it("nomme les domaines en majuscules — ils sont sensibles à la casse", () => {
    for (const domaine of Object.values(DOMAINES)) {
      expect(domaine).toBe(domaine.toUpperCase());
    }
    expect(DOMAINES.recommendationsReceived).toBe("RECOMMENDATIONS");
  });
});
