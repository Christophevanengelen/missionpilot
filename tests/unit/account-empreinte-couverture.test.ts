import { describe, expect, it } from "vitest";
import { EMPREINTE_COUVERTURE, lignesEmpreinte } from "@/lib/account/export";
import { PERSONAL_TABLES } from "@/domain/account";

/**
 * L'écran de suppression doit nommer tout ce qui va disparaître.
 *
 * POURQUOI CE TEST EXISTE. `lignesEmpreinte` est de la prose : elle groupe des
 * tables en phrases lisibles, et ne peut donc pas se dériver mécaniquement de
 * `PERSONAL_TABLES`. C'est exactement ce qui l'a fait dériver. Au 2026-09-01
 * elle ignorait quatre tables — `cv_variants`, `tone_contracts`,
 * `profile_search_plans` et `application_dispatches` — donc l'écran le plus
 * irréversible du produit taisait quatre familles de données, pendant que la
 * politique promettait « l'écran vous montre ce qui va disparaître, avec les
 * nombres de l'instant ».
 *
 * Corriger la liste une fois ne protège de rien : la prochaine table serait
 * oubliée pareil. Ce test rend l'oubli impossible en obligeant à ranger toute
 * table neuve dans `EMPREINTE_COUVERTURE`, avec sa phrase ou son rattachement.
 */
describe("l'empreinte du compte couvre toutes les données personnelles", () => {
  it("range chaque table de PERSONAL_TABLES", () => {
    const couvertes = Object.keys(EMPREINTE_COUVERTURE).sort();
    expect(couvertes).toEqual([...PERSONAL_TABLES].sort());
  });

  it("ne range aucune table qui n'existe pas", () => {
    for (const table of Object.keys(EMPREINTE_COUVERTURE)) {
      expect(PERSONAL_TABLES).toContain(table);
    }
  });

  it("annonce le registre des envois quand il en contient", () => {
    const lignes = lignesEmpreinte({ application_dispatches: 7 });
    expect(lignes.join(" ")).toContain("7 envois enregistrés");
  });

  it("accorde le singulier sur un seul envoi", () => {
    const lignes = lignesEmpreinte({ application_dispatches: 1 });
    expect(lignes.join(" ")).toContain("1 envoi enregistré");
  });

  it("ne montre pas une ligne vide", () => {
    // « 0 envoi » occupe de la place pour ne rien apprendre, au moment le moins
    // confortable.
    expect(lignesEmpreinte({ application_dispatches: 0 })).toEqual([]);
    expect(lignesEmpreinte({})).toEqual([]);
  });

  it("réunit variantes de CV et contrat de ton en une seule phrase", () => {
    const lignes = lignesEmpreinte({ cv_variants: 3, tone_contracts: 1 });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toContain("4 règles d'écriture");
  });
});
