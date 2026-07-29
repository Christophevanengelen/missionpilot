import { describe, expect, it } from "vitest";
import {
  construireDigest,
  echapper,
  meritEnvoi,
  urlSure,
  MAX_OFFRES,
} from "@/lib/digest/contenu";
import type { MarketHit } from "@/lib/search/types";

/**
 * Le digest hebdomadaire, testé là où il compte : son CONTENU.
 *
 * Un e-mail est la seule surface du produit qu'on ne peut pas corriger après
 * coup. Une page fautive se redéploie ; un e-mail parti est parti — chez des
 * gens qui cherchent un emploi, sous notre nom de domaine. D'où des tests sur
 * la composition plutôt que sur l'envoi.
 */

const offre = (p: Partial<MarketHit> & { title: string }): MarketHit =>
  ({
    key: p.sourceUrl ?? p.title,
    title: p.title,
    organization: p.organization ?? "Une entreprise",
    locationText: "Bruxelles",
    engagementType: null,
    remoteType: null,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    skills: [],
    excerpt: null,
    postedAt: null,
    sources: [{ name: p.sourceName ?? "Jobicy", url: p.sourceUrl ?? null }],
    sourceName: p.sourceName ?? "Jobicy",
    // `in` et non `??` : un test qui veut EXPLICITEMENT une offre sans lien
    // doit pouvoir passer `null`, que `??` remplacerait par le défaut.
    sourceUrl: "sourceUrl" in p ? p.sourceUrl : "https://exemple.test/offre",
    gate: "pass",
    score: 50,
    confidence: 1,
    titlePhraseMatch: true,
    matchedSkills: [],
    demandedSkillCount: 0,
    unknowns: [],
  }) as unknown as MarketHit;

const construire = (hits: MarketHit[], stepUpTitles: string[] = []) =>
  construireDigest({
    hits,
    stepUpTitles,
    desabonnementUrl: "https://missionpilot.net/desabonnement?jeton=abc",
    tableauDeBordUrl: "https://missionpilot.net/dashboard",
  });

describe("un digest vide ne part jamais", () => {
  it("refuse l'envoi quand il n'y a rien à montrer", () => {
    // Écrire « rien cette semaine » à quelqu'un qui cherche un emploi, c'est
    // lui coûter une ouverture pour lui apprendre qu'on n'a rien fait pour
    // lui. Le silence est plus honnête.
    expect(meritEnvoi([])).toBe(false);
  });

  it("autorise l'envoi dès qu'il y a une offre", () => {
    expect(meritEnvoi([offre({ title: "Service Designer" })])).toBe(true);
  });
});

describe("l'échappement des textes de tiers", () => {
  it("neutralise le HTML d'un intitulé venu d'un flux", () => {
    expect(echapper('<img src=x onerror="alert(1)">')).not.toContain("<img");
    expect(echapper("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("n'insère JAMAIS un intitulé hostile tel quel dans le HTML", () => {
    // Un lien injecté dans un e-mail qui, lui, vient bien de nous, est le
    // matériau d'un hameçonnage crédible : le destinataire fait confiance à
    // l'expéditeur, pas à la ligne.
    const { html } = construire([
      offre({ title: '</a><a href="https://mechant.test">Cliquez ici' }),
    ]);
    // L'assertion porte sur la BALISE, pas sur la chaîne. L'URL hostile DOIT
    // apparaître dans le HTML — en texte échappé, visible et inerte. Écrire
    // `not.toContain("https://mechant.test")` passerait pour une garantie
    // alors que ça n'en est pas une : ce qui blesse, c'est le `<a href=`, pas
    // les caractères de l'adresse.
    expect(html).not.toContain('<a href="https://mechant.test"');
    expect(html).toContain("&lt;/a&gt;");
    expect(html).toContain("&quot;https://mechant.test&quot;");
  });
});

describe("les URL de source", () => {
  it("accepte http et https", () => {
    expect(urlSure("https://exemple.test/a")).toContain("https://exemple.test");
    expect(urlSure("http://exemple.test/a")).toContain("http://exemple.test");
  });

  it("refuse tout le reste, et le null", () => {
    expect(urlSure("javascript:alert(1)")).toBeNull();
    expect(urlSure("data:text/html,<script>")).toBeNull();
    expect(urlSure("pas une url")).toBeNull();
    expect(urlSure(null)).toBeNull();
  });

  it("écarte l'offre plutôt que l'e-mail entier", () => {
    // Une offre sans lien exploitable n'a rien à faire dans un message dont la
    // seule action est « aller voir l'annonce ».
    const { texte } = construire([
      offre({ title: "Sans lien", sourceUrl: null }),
      offre({ title: "Avec lien", sourceUrl: "https://exemple.test/ok" }),
    ]);
    expect(texte).toContain("Avec lien");
    expect(texte).not.toContain("Sans lien");
  });
});

describe("la marche du dessus mène", () => {
  it("place les postes du cran au-dessus en tête", () => {
    const { texte } = construire(
      [
        offre({ title: "Service Designer", sourceUrl: "https://t.test/1" }),
        offre({ title: "Head of Design", sourceUrl: "https://t.test/2" }),
      ],
      ["Head of Design"],
    );
    expect(texte.indexOf("Head of Design")).toBeLessThan(
      texte.indexOf("Service Designer"),
    );
  });

  it("dit dans l'OBJET combien de marches, quand il y en a", () => {
    // L'objet doit permettre de décider depuis la liste des messages. « Votre
    // digest hebdomadaire » n'apprend rien et se lit comme une infolettre.
    const { objet } = construire(
      [
        offre({ title: "Head of Design", sourceUrl: "https://t.test/2" }),
        offre({ title: "Service Designer", sourceUrl: "https://t.test/1" }),
      ],
      ["Head of Design"],
    );
    expect(objet).toContain("au-dessus");
  });
});

describe("les obligations qui voyagent avec les offres", () => {
  it("porte l'attribution Adzuna DANS l'e-mail aussi", () => {
    // La clause porte sur les données AFFICHÉES, et un e-mail les affiche. La
    // satisfaire à l'écran et l'oublier dans le courrier, c'est la respecter à
    // moitié.
    const { html, texte } = construire([
      offre({ title: "Designer", sourceName: "Adzuna" }),
    ]);
    expect(texte).toContain("by Adzuna");
    expect(html).toContain("by Adzuna");
  });

  it("porte toujours une sortie, en HTML comme en texte", () => {
    const { html, texte } = construire([offre({ title: "Designer" })]);
    expect(html).toContain("/desabonnement?jeton=abc");
    expect(texte).toContain("/desabonnement?jeton=abc");
  });

  it("répète la promesse : on ne postule jamais à votre place", () => {
    const { texte } = construire([offre({ title: "Designer" })]);
    expect(texte.toLowerCase()).toContain("jamais en votre nom");
  });
});

describe("la longueur", () => {
  it("ne dépasse pas la borne, même avec cinquante offres", () => {
    // Un digest de quarante lignes ne se lit pas : il se ferme.
    const hits = Array.from({ length: 50 }, (_, i) =>
      offre({ title: `Poste ${i}`, sourceUrl: `https://t.test/${i}` }),
    );
    const { texte } = construire(hits);
    const liens = texte.match(/https:\/\/t\.test\//g) ?? [];
    expect(liens).toHaveLength(MAX_OFFRES);
  });
});
