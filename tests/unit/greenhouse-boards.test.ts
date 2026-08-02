import { describe, expect, it } from "vitest";
import {
  activeBoards,
  EXCLUDED_BOARDS,
  GREENHOUSE_BOARDS,
} from "@/lib/discovery/greenhouse-boards";

/**
 * La liste des employeurs interrogés.
 *
 * Ce fichier est la seule chose que MissionPilot garde en dehors du profil :
 * une liste de SOCIÉTÉS, pas d'offres. Ces tests protègent les deux propriétés
 * qui font qu'elle reste défendable — le retrait fonctionne, et un jeton ne
 * peut pas envoyer la requête ailleurs.
 */

describe("un employeur peut se retirer, et le retrait marche", () => {
  it("écarte un tableau listé dans les exclusions", () => {
    // Le mécanisme existe avant d'être utilisé. Un dispositif de retrait
    // ajouté après la première plainte est un dispositif arrivé en retard.
    expect(activeBoards(["alpha", "beta"], ["beta"])).toEqual(["alpha"]);
  });

  it("ignore la casse et les espaces d'un retrait", () => {
    // Sans ça, un employeur retiré sous « Beta » resterait interrogé.
    expect(activeBoards(["beta"], ["  BETA "])).toEqual([]);
  });

  it("ne rend aucun doublon même si la liste en contient", () => {
    expect(activeBoards(["alpha", "Alpha", "alpha"])).toEqual(["alpha"]);
  });
});

describe("un jeton ne peut pas détourner la requête", () => {
  it("écarte tout ce qui n'est pas une étiquette simple", () => {
    // Le jeton entre dans un chemin d'URL. On ÉCARTE plutôt qu'on n'échappe :
    // aucun jeton légitime ne contient de barre, de point ou d'arobase, et
    // échapper laisse toujours une variante oubliée.
    const dangereux = [
      "../../etc",
      "a/b",
      "evil.com",
      "user@host",
      "-leading",
      "",
      "a".repeat(64),
      "UPPER/CASE",
    ];
    expect(activeBoards(dangereux)).toEqual([]);
  });

  it("accepte les jetons réels, tirets compris", () => {
    expect(activeBoards(["n26", "grafana-labs", "a1"])).toEqual([
      "n26",
      "grafana-labs",
      "a1",
    ]);
  });
});

describe("la liste livrée", () => {
  it("ne contient que des jetons valides — aucun n'est silencieusement perdu", () => {
    // Un jeton mal écrit serait écarté par `activeBoards` SANS bruit : la
    // société ne serait jamais interrogée et personne ne le saurait. Cette
    // égalité est ce qui rend cet oubli visible.
    expect(activeBoards(GREENHOUSE_BOARDS, [])).toHaveLength(
      GREENHOUSE_BOARDS.length,
    );
  });

  it("n'interroge personne qui se soit retiré", () => {
    const actifs = activeBoards();
    for (const retire of EXCLUDED_BOARDS) {
      expect(actifs).not.toContain(retire.trim().toLowerCase());
    }
  });

  it("reste bornée — une source lente est une source qu'on éteint", () => {
    // Chaque tableau est un aller-retour HTTP. La borne n'est pas esthétique :
    // c'est le budget de latence d'une visite. Si ce test casse un jour, la
    // bonne réponse est de curer, pas de monter le chiffre.
    expect(GREENHOUSE_BOARDS.length).toBeLessThanOrEqual(40);
  });
});
