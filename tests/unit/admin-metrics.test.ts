import { describe, expect, it, vi } from "vitest";
import {
  acquisitionParSemaine,
  ecartEnJours,
  entonnoir,
  recommandation,
  retention,
  type CompteAnonyme,
  type ProfilAnonyme,
} from "@/lib/admin/metrics";

vi.mock("server-only", () => ({}));

/**
 * Les définitions de métriques — testées parce qu'une définition fausse ne se
 * voit jamais.
 *
 * Un chiffre s'affiche toujours. Il ne plante pas, il ne ralentit rien : il se
 * contente d'être faux, et on pilote dessus pendant des mois. C'est le seul
 * endroit du produit où un test protège contre une erreur de JUGEMENT plutôt
 * que contre une régression.
 */

const compte = (
  creeLe: string,
  derniereConnexion: string | null = null,
  emailConfirme = true,
): CompteAnonyme => ({ creeLe, derniereConnexion, emailConfirme });

const profil = (p: Partial<ProfilAnonyme> = {}): ProfilAnonyme => ({
  creeLe: "2026-07-01T10:00:00Z",
  affirmationsConfirmees: 0,
  aDesMetiersCibles: false,
  aDesPreuves: false,
  abonneAuDigest: false,
  ...p,
});

describe("l'activation n'est pas l'inscription", () => {
  it("ne compte comme activé que ce qui ouvre RÉELLEMENT la recherche", () => {
    // Compter les inscrits comme des utilisateurs est la manière la plus
    // courante de se mentir sur la traction. Le seuil du produit, c'est le
    // moment où l'écran montre des offres.
    const etapes = entonnoir(
      [compte("2026-07-01T10:00:00Z"), compte("2026-07-02T10:00:00Z")],
      [profil(), profil({ aDesMetiersCibles: true })],
    );
    const actives = etapes.find((e) => e.cle === "actives");
    expect(actives?.compte).toBe(1);
    expect(etapes.find((e) => e.cle === "inscrits")?.compte).toBe(2);
  });

  it("compte la conversion sur le palier PRÉCÉDENT, pas sur le total", () => {
    // C'est la seule lecture qui dise OÙ ça coince. Rapportée au total, une
    // chute tardive se noie dans la moyenne.
    const etapes = entonnoir(
      [
        compte("2026-07-01T10:00:00Z", null, true),
        compte("2026-07-01T10:00:00Z", null, false),
      ],
      [profil({ affirmationsConfirmees: 1 })],
    );
    expect(etapes[0].conversion).toBeNull(); // la première marche n'en a pas
    expect(etapes[1].compte).toBe(1);
    expect(etapes[1].conversion).toBe(50); // 1 confirmé sur 2 inscrits
  });

  it("ne divise jamais par zéro sur un produit sans utilisateur", () => {
    const etapes = entonnoir([], []);
    expect(etapes.every((e) => e.compte === 0)).toBe(true);
    expect(etapes.every((e) => e.conversion === null)).toBe(true);
  });
});

describe("« revenu » veut dire un AUTRE jour", () => {
  it("ne compte pas la session d'inscription comme un retour", () => {
    // Quelqu'un qui se connecte dans la minute qui suit son inscription n'est
    // pas revenu : c'est encore la même visite. Le compter gonflerait la
    // rétention de 100 % dès le premier jour.
    const meme = compte("2026-07-01T10:00:00Z", "2026-07-01T10:02:00Z");
    const revenu = compte("2026-07-01T10:00:00Z", "2026-07-03T09:00:00Z");
    const etapes = entonnoir([meme, revenu], []);
    expect(etapes.find((e) => e.cle === "revenus")?.compte).toBe(1);
  });

  it("classe « jamais revenu » celui qui n'a aucune connexion", () => {
    const r = retention(
      [compte("2026-07-01T10:00:00Z", null)],
      Date.parse("2026-07-30T10:00:00Z"),
    );
    expect(r.jamaisRevenus).toBe(1);
    expect(r.actifs7j).toBe(0);
    expect(r.actifs30j).toBe(0);
  });

  it("mesure les fenêtres depuis l'instant DONNÉ, jamais depuis l'horloge", () => {
    // L'instant est un paramètre : un test qui dépendrait de `Date.now()`
    // passerait aujourd'hui et échouerait dans un mois.
    const maintenant = Date.parse("2026-07-30T10:00:00Z");
    const r = retention(
      [
        compte("2026-06-01T10:00:00Z", "2026-07-28T10:00:00Z"), // 2 jours
        compte("2026-06-01T10:00:00Z", "2026-07-15T10:00:00Z"), // 15 jours
        compte("2026-06-01T10:00:00Z", "2026-05-01T10:00:00Z"), // très ancien
      ],
      maintenant,
    );
    expect(r.actifs7j).toBe(1);
    expect(r.actifs30j).toBe(2);
  });
});

describe("les dates illisibles ne deviennent pas des zéros", () => {
  it("rend null plutôt que de compter « le même jour »", () => {
    expect(ecartEnJours("pas une date", "2026-07-30T10:00:00Z")).toBeNull();
    expect(ecartEnJours("2026-07-01T00:00:00Z", "2026-07-04T00:00:00Z")).toBe(
      3,
    );
  });

  it("ignore un compte à la date cassée dans le découpage hebdomadaire", () => {
    const semaines = acquisitionParSemaine([
      compte("2026-07-01T10:00:00Z"),
      compte("date cassée"),
    ]);
    expect(semaines.reduce((n, s) => n + s.compte, 0)).toBe(1);
  });

  it("groupe sur le lundi UTC, pas sur le fuseau du lecteur", () => {
    // Un découpage local ferait bouger les frontières de cohorte selon qui
    // regarde le tableau — deux personnes verraient deux chiffres.
    const semaines = acquisitionParSemaine([
      compte("2026-07-01T10:00:00Z"), // mercredi
      compte("2026-07-05T23:00:00Z"), // dimanche, même semaine ISO
      compte("2026-07-06T01:00:00Z"), // lundi, semaine suivante
    ]);
    expect(semaines).toEqual([
      { semaine: "2026-06-29", compte: 2 },
      { semaine: "2026-07-06", compte: 1 },
    ]);
  });
});

describe("ce qu'on ne mesure pas est dit, pas rempli d'un zéro", () => {
  it("déclare l'absence de parrainage au lieu d'afficher 0", () => {
    // Un zéro se lit comme un échec de traction. « Pas de mécanique » se lit
    // comme ce que c'est : une fonctionnalité qui n'existe pas.
    const r = recommandation([profil({ abonneAuDigest: true }), profil()]);
    expect(r.parrainageExiste).toBe(false);
    expect(r.abonnesDigest).toBe(1);
  });
});
