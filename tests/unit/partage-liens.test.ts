import { describe, expect, it } from "vitest";
import {
  chargeNative,
  lienReseau,
  OBJET,
  TEXTE,
  type Reseau,
} from "@/lib/partage/liens";

/**
 * Le partage est la seule fonction du produit qui envoie quelque chose vers
 * l'extérieur. Ces tests portent donc moins sur le format des URL que sur ce
 * qu'elles ne contiennent pas.
 */

const URL_PUBLIQUE = "https://missionpilot.net";
const RESEAUX: Reseau[] = ["linkedin", "x", "bluesky", "email"];

describe("on partage le produit, jamais la personne", () => {
  it("n'accepte aucune donnée de parcours — le module n'a pas de porte d'entrée", () => {
    // La garantie est de TYPE, pas de discipline : `lienReseau` prend un
    // réseau et une URL, rien d'autre. Ce test existe pour qu'une signature
    // élargie plus tard (« et si on passait le poste regardé ? ») casse ici,
    // et pas en production sur le profil de quelqu'un.
    expect(lienReseau.length).toBe(2);
    expect(chargeNative.length).toBe(1);
  });

  it("ne fait fuiter aucun paramètre de suivi dans l'adresse partagée", () => {
    // Un `?via=`, `?utm_`, `?ref=` ne mesurerait rien — le produit
    // n'enregistre aucune visite — et créerait une URL dupliquée pour les
    // moteurs. On partage l'adresse nue.
    for (const r of RESEAUX) {
      const lien = lienReseau(r, URL_PUBLIQUE);
      const decode = decodeURIComponent(lien);
      expect(decode).not.toMatch(/[?&](utm_|via=|ref=|fbclid=)/);
    }
  });
});

describe("chaque réseau reçoit ce qu'il sait lire", () => {
  it("n'envoie QUE l'URL à LinkedIn, qui ignore tout texte pré-rempli", () => {
    const lien = lienReseau("linkedin", URL_PUBLIQUE);
    expect(lien).toContain("linkedin.com/sharing/share-offsite/");
    expect(lien).toContain(encodeURIComponent(URL_PUBLIQUE));
    // Y glisser le texte donnerait l'illusion d'un message rédigé, que
    // LinkedIn jettera : c'est l'aperçu Open Graph qui parle à sa place.
    expect(lien).not.toContain(encodeURIComponent(TEXTE));
  });

  it("met le lien DANS le texte pour Bluesky, qui n'a pas de champ séparé", () => {
    const lien = lienReseau("bluesky", URL_PUBLIQUE);
    const texte = decodeURIComponent(new URL(lien).searchParams.get("text")!);
    expect(texte).toContain(TEXTE);
    expect(texte).toContain(URL_PUBLIQUE);
  });

  it("sépare texte et URL pour X, qui a les deux champs", () => {
    const params = new URL(lienReseau("x", URL_PUBLIQUE)).searchParams;
    expect(params.get("text")).toBe(TEXTE);
    expect(params.get("url")).toBe(URL_PUBLIQUE);
  });

  it("compose un mailto avec objet et corps, l'URL sur sa propre ligne", () => {
    const lien = lienReseau("email", URL_PUBLIQUE);
    expect(lien.startsWith("mailto:?")).toBe(true);
    const params = new URLSearchParams(lien.slice("mailto:?".length));
    expect(params.get("subject")).toBe(OBJET);
    expect(params.get("body")).toContain(`\n\n${URL_PUBLIQUE}`);
  });

  it("produit des URL absolues et valides pour tous les réseaux web", () => {
    for (const r of RESEAUX.filter((x) => x !== "email")) {
      expect(() => new URL(lienReseau(r, URL_PUBLIQUE))).not.toThrow();
      expect(lienReseau(r, URL_PUBLIQUE).startsWith("https://")).toBe(true);
    }
  });

  it("échappe une URL à paramètres sans casser le lien d'intention", () => {
    // Le jour où l'adresse publique porterait un chemin ou une requête, une
    // concaténation naïve casserait le lien du réseau plutôt que la nôtre.
    const avecQuery = "https://missionpilot.net/?a=1&b=2";
    const params = new URL(lienReseau("x", avecQuery)).searchParams;
    expect(params.get("url")).toBe(avecQuery);
  });
});

describe("la charge native dit la même chose que les liens", () => {
  it("porte titre, texte et URL — les trois champs que la feuille système lit", () => {
    expect(chargeNative(URL_PUBLIQUE)).toEqual({
      title: OBJET,
      text: TEXTE,
      url: URL_PUBLIQUE,
    });
  });
});
