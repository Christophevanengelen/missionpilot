import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La connexion Google / LinkedIn — les garanties qui ne se voient pas.
 *
 * Ces tests lisent les fichiers plutôt que d'exécuter le flux : un parcours
 * OAuth complet exige un fournisseur vivant, et ce qu'on protège ici n'est pas
 * le protocole (c'est le travail de Supabase) mais NOS décisions autour — les
 * gardes, le chemin de retour, et l'honnêteté de la politique.
 */

const racine = process.cwd();
const actions = readFileSync(join(racine, "src/lib/auth/actions.ts"), "utf8");
const formulaire = readFileSync(
  join(racine, "src/app/(auth)/login/login-form.tsx"),
  "utf8",
);
const politique = readFileSync(
  join(racine, "content/legal/politique-de-confidentialite.md"),
  "utf8",
);

describe("chaque fournisseur est gardé DEUX fois", () => {
  it("l'action revérifie l'interrupteur — un POST forgé est un non-événement", () => {
    // Le bouton n'existe pas sans l'interrupteur, mais un POST se forge sans
    // bouton. L'action doit revérifier elle-même, sinon la garde n'est qu'un
    // décor côté écran.
    expect(actions).toMatch(
      /AUTH_GOOGLE_ENABLED !== true\) redirect\("\/login"\)/,
    );
    expect(actions).toMatch(
      /AUTH_LINKEDIN_ENABLED !== true\) redirect\("\/login"\)/,
    );
  });

  it("le formulaire n'affiche un bouton que si son interrupteur est vrai", () => {
    // Un bouton vers un fournisseur non configuré mène à une erreur au
    // premier écran — le piège du bouton LinkedIn avant l'accord.
    expect(formulaire).toMatch(/\{google \? \(/);
    expect(formulaire).toMatch(/\{linkedin \? \(/);
  });
});

describe("le flux revient là où le code s'échange", () => {
  it("redirige vers /auth/confirm — la route publique qui sait déjà échanger un code", () => {
    // C'est la route existante du lien magique, déjà dans PUBLIC_PATHS, déjà
    // capable de `exchangeCodeForSession`. Un autre chemin de retour serait
    // intercepté par le proxy avant qu'une session existe.
    expect(actions).toMatch(
      /redirectTo: `\$\{env\.NEXT_PUBLIC_APP_URL\}\/auth\/confirm`/,
    );
  });

  it("le flux part du SERVEUR — le vérificateur PKCE se pose ici", () => {
    // `signInWithOAuth` côté serveur pose le cookie du vérificateur que le
    // retour comparera. Depuis le navigateur, l'appariement casserait.
    expect(actions).toContain('"use server"');
    expect(actions).toMatch(/signInWithOAuth/);
  });
});

describe("la politique de confidentialité dit ce que la connexion sociale change", () => {
  it("déclare le fournisseur comme responsable distinct, pas comme sous-traitant", () => {
    // Google n'agit pas sur nos instructions quand quelqu'un se connecte : le
    // qualifier de sous-traitant serait juridiquement faux et rassurant à
    // tort. L'art. 13(1)(e) exige de nommer le destinataire tel qu'il est.
    expect(politique).toContain("Google / LinkedIn");
    expect(politique).toMatch(/[Rr]esponsable de traitement distinct/);
  });

  it("dit la SEULE chose que le fournisseur apprend de nous", () => {
    // « Il apprend que vous utilisez MissionPilot » — c'est inhérent au
    // mécanisme, et le taire serait le genre d'omission que cette politique
    // s'interdit.
    expect(politique).toMatch(/apprend que vous utilisez MissionPilot/);
  });
});
