import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { LOG_LEVEL: "error", APP_ENV: "local" },
}));

const { empreinteDossier, versionsPrompt } =
  await import("@/lib/search/plan-store");
const { planDeRepli, bornerPlan, MAX_SEARCH_PLANS } =
  await import("@/lib/search/plan-from-profile");
type ProfileSearchPlan = ReturnType<typeof planDeRepli>;
const { TRIAGE_TIMEOUT_MS } = await import("@/lib/search/ai-triage");

const aiTriage = readFileSync(
  join(process.cwd(), "src/lib/search/ai-triage.ts"),
  "utf8",
);

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

describe("le seul appel de modèle qui reste dans le rendu déclare son budget", () => {
  it("attend BEAUCOUP moins que le plafond de 30 s du fournisseur", () => {
    // Le tri héritait du plafond du fournisseur : 30 s, soit plus que la durée
    // de vie de la fonction qui rend la page. Un tri lent n'y dégradait donc
    // pas l'écran — il l'empêchait d'exister, sans erreur applicative, la
    // frontière `Suspense` ne se résolvant jamais.
    expect(TRIAGE_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(aiTriage).toMatch(/timeoutMs:\s*TRIAGE_TIMEOUT_MS/);
  });

  it("rend la main sans verdict plutôt que de faire attendre", () => {
    // Le dépassement passe par le `catch` comme le reste : on garde toutes les
    // offres et le classement déterministe s'affiche. Une liste ordonnée par
    // des règles vaut infiniment mieux qu'une page blanche.
    expect(aiTriage).toMatch(/return null;/);
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

/**
 * La panne du 2026-07-29 au soir : le tableau de bord n'affichait plus RIEN.
 *
 * Mesurée dans les journaux de production, pas supposée — sur le rendu de
 * 17h55, France Travail, qui est une entrée de source et une seule, a
 * enregistré DOUZE recherches. Le plan précalculé en portait donc douze, contre
 * trois au plus pour le repli déterministe : chaque intitulé étant rejoué sur
 * chaque entrée de source (Adzuna et Himalayas en comptent une PAR PAYS), un
 * seul rendu lançait de 96 à 144 recherches. La fonction mourait en cours de
 * stream et la frontière `Suspense` ne se résolvait jamais.
 */
const planA12Intitules = (): ProfileSearchPlan => {
  const niveau = [
    "Service Designer",
    "Product Designer",
    "UX Designer",
    "Experience Designer",
    "Designer CX",
    "Design Lead",
  ];
  const marche = [
    "Design Director",
    "Head of Design",
    "Directeur du design",
    "Head of CX",
    "VP Design",
    "Directeur de l'expérience",
  ];
  const tous = [...niveau, ...marche];
  return {
    plans: tous.map((t) => ({ keywords: [t], mode: "title" as const })),
    stepUpTitles: marche,
    trajectory: null,
    searchedTitles: tous,
  };
};

describe("bornerPlan", () => {
  it("ramène les douze intitulés de la panne à ce qu'un rendu peut porter", () => {
    const borne = bornerPlan(planA12Intitules());
    expect(borne.plans).toHaveLength(MAX_SEARCH_PLANS);
    expect(MAX_SEARCH_PLANS).toBeLessThanOrEqual(4);
  });

  it("garde une marche : l'escalier est la raison d'être du plan", () => {
    // Une simple troncature des quatre premiers garderait six intitulés de
    // niveau et zéro marche — le plan coûterait alors trois appels de modèle
    // pour un résultat que le repli déterministe produit gratuitement.
    const borne = bornerPlan(planA12Intitules());
    expect(borne.stepUpTitles.length).toBeGreaterThan(0);
    const mots = borne.plans.flatMap((p) => p.keywords);
    for (const titre of borne.stepUpTitles) expect(mots).toContain(titre);
  });

  it("n'annonce AUCUN mot qu'il n'a pas envoyé", () => {
    // L'écran qui explique pourquoi la liste est ce qu'elle est ne doit nommer
    // que les recherches réellement faites. Annoncer douze intitulés pour en
    // chercher quatre serait un mensonge à l'endroit exact où on promet la
    // transparence.
    const borne = bornerPlan(planA12Intitules());
    const mots = borne.plans.flatMap((p) => p.keywords);
    expect(borne.searchedTitles).toEqual(mots);
    for (const titre of borne.stepUpTitles) expect(mots).toContain(titre);
  });

  it("laisse INTACT un plan déjà dans les clous", () => {
    // Le repli déterministe en produit au plus trois : la borne ne doit rien
    // lui changer, ni son ordre, ni ses mots.
    const repli = planDeRepli(["Service Designer", "Product Designer"], []);
    expect(bornerPlan(repli)).toEqual(repli);
  });

  it("ne casse pas sur une ligne JSON mal formée", () => {
    // Le plan vient d'une colonne `jsonb` : une borne de sécurité qui plante
    // sur ce qu'elle est censée protéger ne protège rien.
    const bancal = {
      plans: null,
      stepUpTitles: null,
      trajectory: null,
      searchedTitles: null,
    } as unknown as ProfileSearchPlan;
    expect(() => bornerPlan(bancal)).not.toThrow();
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
