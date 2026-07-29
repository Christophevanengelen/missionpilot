import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { LOG_LEVEL: "error", APP_ENV: "local" },
}));

const { empreinteDossier, versionsPrompt } =
  await import("@/lib/search/plan-store");
const { planDeRepli } = await import("@/lib/search/plan-from-profile");

/**
 * Le plan de recherche précalculé.
 *
 * Ce que ces tests protègent tient en une mesure : le 2026-07-29, le tableau de
 * bord enchaînait trois appels de modèle AVANT que la recherche ne commence —
 * 10,1 s sur un affichage, 22,6 s sur le suivant. La page ne montrait que son
 * en-tête pendant ce temps, assez longtemps pour passer pour cassée.
 *
 * La régression est invisible en fonctionnel : réintroduire un appel de modèle
 * dans le rendu ne casse aucun écran, ça les rend seulement inutilisables. D'où
 * le test qui lit le fichier de rendu lui-même.
 */

const autoResults = readFileSync(
  join(process.cwd(), "src/app/(dashboard)/dashboard/auto-results.tsx"),
  "utf8",
);

describe("le rendu n'appelle aucun modèle pour planifier", () => {
  it("n'importe PAS le calcul complet", () => {
    // `calculerPlan` et `planFromProfile` font tous deux les trois appels.
    // Leur place est dans le travail de fond, jamais dans un composant rendu.
    expect(autoResults).not.toMatch(/\bcalculerPlan\b/);
    expect(autoResults).not.toMatch(/\bplanFromProfile\b/);
  });

  it("lit le plan rangé et se rabat sur le repli déterministe", () => {
    expect(autoResults).toMatch(/lirePlanPrecalcule/);
    expect(autoResults).toMatch(/planDeRepli/);
  });

  it("demande le recalcul SANS l'attendre", () => {
    // `void` et non `await` : si cette demande devenait bloquante, l'écran
    // retrouverait ses vingt-cinq secondes et personne ne ferait le lien.
    expect(autoResults).toMatch(/void demanderRecalculDuPlan/);
    expect(autoResults).not.toMatch(/await demanderRecalculDuPlan/);
  });
});

describe("empreinteDossier", () => {
  it("rend la même empreinte pour le même dossier", () => {
    const d = "Rôle : Service Designer\nSéniorité : senior";
    expect(empreinteDossier(d)).toBe(empreinteDossier(d));
    expect(empreinteDossier(d)).toHaveLength(64);
  });

  it("change dès que le dossier change", () => {
    // C'est TOUTE la validité du cache : un profil corrigé doit invalider le
    // plan, sinon on cherche pour la personne qu'elle était avant.
    expect(empreinteDossier("Service Designer")).not.toBe(
      empreinteDossier("Service Designer senior"),
    );
  });

  it("ignore les espaces de fin de ligne", () => {
    // Un espace en fin de ligne ne change pas ce qu'on a compris de quelqu'un.
    // Le faire recalculer trois appels de modèle serait absurde.
    expect(empreinteDossier("Rôle : X  \nSéniorité : Y")).toBe(
      empreinteDossier("Rôle : X\nSéniorité : Y"),
    );
  });

  it("distingue deux dossiers dont seul l'ordre change", () => {
    // Deux dossiers composés des mêmes lignes dans un ordre différent ne
    // décrivent pas la même personne pour un modèle : ils ne doivent pas
    // partager un plan.
    expect(empreinteDossier("A\nB")).not.toBe(empreinteDossier("B\nA"));
  });
});

describe("versionsPrompt", () => {
  it("nomme les DEUX prompts qui produisent le plan", () => {
    // Sans ce marqueur, améliorer un prompt laisserait tous les profils
    // existants sur l'ancien résultat pour toujours : le dossier n'a pas
    // changé, donc l'empreinte non plus.
    expect(versionsPrompt()).toContain("career-trajectory");
    expect(versionsPrompt()).toContain("market-vocabulary");
  });
});

describe("planDeRepli", () => {
  it("cherche sur les métiers cibles quand il y en a", () => {
    const plan = planDeRepli(["Service Designer"], []);
    expect(plan.searchedTitles.length).toBeGreaterThan(0);
    expect(plan.trajectory).toBeNull();
    expect(plan.stepUpTitles).toEqual([]);
  });

  it("annonce les mots RÉELLEMENT cherchés, pas les métiers cibles", () => {
    // Le repli peut se rabattre sur le rôle confirmé ou sur les compétences.
    // Annoncer autre chose que ce qu'on a fait serait un mensonge sur l'écran
    // même qui doit expliquer pourquoi la liste est ce qu'elle est.
    const plan = planDeRepli(
      [],
      [{ kind: "role", state: "confirmed", value: { title: "Data Engineer" } }],
    );
    const motsDesPlans = plan.plans.flatMap((p) => p.keywords);
    for (const mot of plan.searchedTitles) {
      expect(motsDesPlans).toContain(mot);
    }
  });

  it("ne rend jamais de trajectoire — il n'a lu aucun modèle", () => {
    expect(planDeRepli([], []).trajectory).toBeNull();
  });
});
