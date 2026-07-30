import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const env = {
  LOG_LEVEL: "error",
  APP_ENV: "local",
  ADMIN_EMAILS: "" as string,
};
vi.mock("@/lib/env", () => ({ env }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));

const { estAdmin } = await import("@/lib/auth/dal");

/**
 * La garde du tableau de pilotage.
 *
 * Une liste d'adresses plutôt qu'un rôle en base : une variable
 * d'environnement se modifie par un déploiement, tracé et réversible, là où
 * une colonne « admin » se modifie par une requête et invite à l'élévation de
 * privilège.
 */
describe("la liste des administrateurs", () => {
  it("n'autorise PERSONNE quand elle est vide", () => {
    // Un panneau d'administration qui s'ouvre par défaut est une porte, pas
    // une fonctionnalité. Y compris pour le propriétaire.
    env.ADMIN_EMAILS = "";
    expect(estAdmin("cve@hi-def.be")).toBe(false);
    expect(estAdmin(null)).toBe(false);
  });

  it("tolère la casse et les espaces d'une saisie humaine", () => {
    // Cette liste se tape à la main dans une console de déploiement. Une
    // comparaison stricte refuserait la bonne personne sans rien expliquer.
    env.ADMIN_EMAILS = " CVE@Hi-Def.be , autre@test.fr ";
    expect(estAdmin("cve@hi-def.be")).toBe(true);
    expect(estAdmin("  CVE@HI-DEF.BE  ")).toBe(true);
    expect(estAdmin("autre@test.fr")).toBe(true);
  });

  it("refuse une adresse absente, et une session sans adresse", () => {
    env.ADMIN_EMAILS = "cve@hi-def.be";
    expect(estAdmin("quelquun@ailleurs.com")).toBe(false);
    expect(estAdmin(null)).toBe(false);
    expect(estAdmin("")).toBe(false);
  });

  it("ne se laisse pas berner par une sous-chaîne", () => {
    // `includes` sur la LISTE, jamais sur la chaîne : sinon
    // « cve@hi-def.be.attaquant.com » passerait.
    env.ADMIN_EMAILS = "cve@hi-def.be";
    expect(estAdmin("cve@hi-def.be.attaquant.com")).toBe(false);
    expect(estAdmin("pas-cve@hi-def.be")).toBe(false);
  });
});
