import { buildStaircase } from "@/lib/search/staircase";
import { creditsFor } from "@/lib/discovery/credits";
import type { MarketHit } from "@/lib/search/types";

/**
 * L'e-mail hebdomadaire, composé — et rien envoyé depuis ce fichier.
 *
 * Module PUR : il reçoit des offres, il rend trois chaînes. C'est ce qui permet
 * de tester le contenu d'un e-mail sans clé d'API, sans réseau et sans boîte
 * aux lettres, donc de le tester vraiment.
 *
 * CE QUE CET E-MAIL DOIT ÊTRE, et il n'y a qu'une phrase qui compte : la
 * preuve que le système a travaillé pendant que la personne ne regardait pas.
 * Il n'y a donc ni relance, ni « vous nous manquez », ni compteur de jours
 * d'inactivité. S'il n'y a rien à montrer, il ne part pas — voir `meritEnvoi`.
 */

/**
 * Combien d'offres au maximum.
 *
 * Un digest de quarante lignes ne se lit pas : il se ferme. Huit tient dans un
 * écran de téléphone, et le lien vers le tableau de bord porte le reste — qui
 * y sera de toute façon plus frais, puisque rien n'est stocké.
 */
export const MAX_OFFRES = 8;

/**
 * Un digest vide ne part JAMAIS.
 *
 * Écrire « rien cette semaine » à quelqu'un qui cherche un emploi, c'est lui
 * coûter l'ouverture d'un e-mail pour lui apprendre qu'on n'a rien fait pour
 * lui. Le silence est plus honnête, et il garde à l'e-mail suivant la valeur
 * d'un e-mail qui contient quelque chose.
 */
export function meritEnvoi(hits: readonly MarketHit[]): boolean {
  return hits.length > 0;
}

/**
 * Échappement HTML des textes de TIERS.
 *
 * Les intitulés et les employeurs viennent de flux qu'on ne contrôle pas. Un
 * titre contenant `<` casserait la mise en page au mieux, injecterait un lien
 * au pire — et un lien injecté dans un e-mail qui, lui, vient bien de nous est
 * exactement le matériau d'un hameçonnage crédible.
 */
export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * N'accepte que `http` et `https`.
 *
 * Une URL de source est une donnée tierce. `javascript:` ne s'exécute pas dans
 * un client mail sérieux, mais un `data:` ou un schéma exotique passé tel quel
 * dans un `href` est une surface qu'on n'a aucune raison d'offrir. Une URL
 * refusée fait tomber l'offre, jamais l'e-mail entier.
 */
export function urlSure(brut: string | null): string | null {
  if (brut === null) return null;
  try {
    const url = new URL(brut);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type Digest = { objet: string; html: string; texte: string };

type Entree = { hit: MarketHit; url: string; marche: boolean };

/** Les offres retenues, marche du dessus en tête, sans celles qu'on ne peut
 *  pas lier — une offre sans lien d'origine n'a rien à faire dans un e-mail
 *  dont la seule action est « aller voir l'annonce ». */
function retenir(
  hits: readonly MarketHit[],
  stepUpTitles: readonly string[],
): Entree[] {
  const bandes = buildStaircase(hits, stepUpTitles, {
    stepUp: null,
    level: null,
  });
  const entrees: Entree[] = [];
  for (const bande of bandes) {
    for (const hit of bande.hits) {
      const url = urlSure(hit.sourceUrl);
      if (url === null) continue;
      entrees.push({ hit, url, marche: bande.key === "step_up" });
      if (entrees.length === MAX_OFFRES) return entrees;
    }
  }
  return entrees;
}

function lieu(hit: MarketHit): string {
  const parts = [hit.organization, hit.locationText].filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  return parts.join(" · ");
}

export function construireDigest({
  hits,
  stepUpTitles,
  desabonnementUrl,
  tableauDeBordUrl,
}: {
  hits: readonly MarketHit[];
  stepUpTitles: readonly string[];
  desabonnementUrl: string;
  tableauDeBordUrl: string;
}): Digest {
  const entrees = retenir(hits, stepUpTitles);
  const marches = entrees.filter((e) => e.marche).length;

  // L'objet dit ce qu'il y a dedans. « Votre digest hebdomadaire » n'apprend
  // rien et se lit comme une infolettre ; un nombre et une marche se décident
  // depuis la liste des messages.
  const objet =
    marches > 0
      ? `${marches} poste${marches > 1 ? "s" : ""} un cran au-dessus, et ${entrees.length - marches} autre${entrees.length - marches > 1 ? "s" : ""}`
      : `${entrees.length} offre${entrees.length > 1 ? "s" : ""} pour vous cette semaine`;

  // L'attribution est due ICI AUSSI. La clause d'Adzuna porte sur les données
  // AFFICHÉES, et un e-mail les affiche : la satisfaire à l'écran et l'oublier
  // dans le courrier serait la respecter à moitié.
  const credits = creditsFor(entrees.map((e) => e.hit.sourceName));

  const lignesTexte = entrees.map((e) => {
    const marque = e.marche ? "↑ " : "  ";
    return `${marque}${e.hit.title ?? "Sans intitulé"}\n   ${lieu(e.hit)}\n   ${e.url}`;
  });

  const texte = [
    marches > 0
      ? "La marche du dessus, d'abord — ces postes sont un cran au-dessus de votre niveau actuel, et votre parcours montre que vous pouvez les défendre."
      : "Ce que le marché a pour vous cette semaine.",
    "",
    ...lignesTexte,
    "",
    `Tout voir : ${tableauDeBordUrl}`,
    "",
    credits.length > 0
      ? credits
          .map((c) => `${c.prefix}${c.linkText}${c.suffix} — ${c.href}`)
          .join("\n")
      : "",
    "",
    "Nous ne postulons jamais en votre nom. Chaque lien mène à l'annonce d'origine, chez l'employeur.",
    `Se désabonner : ${desabonnementUrl}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const lignesHtml = entrees
    .map((e) => {
      const titre = echapper(e.hit.title ?? "Sans intitulé");
      const sous = echapper(lieu(e.hit));
      const badge = e.marche
        ? `<span style="display:inline-block;font-size:11px;color:#166534;background:#dcfce7;border-radius:4px;padding:2px 6px;margin-right:6px;">la marche d'après</span>`
        : "";
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        ${badge}
        <a href="${echapper(e.url)}" style="color:#111827;font-size:15px;font-weight:600;text-decoration:none;">${titre}</a>
        <div style="color:#6b7280;font-size:13px;margin-top:2px;">${sous}</div>
      </td></tr>`;
    })
    .join("");

  const creditsHtml =
    credits.length > 0
      ? `<p style="color:#9ca3af;font-size:11px;margin:16px 0 0;">${credits
          .map(
            (c) =>
              `${echapper(c.prefix)}<a href="${echapper(c.href)}" style="color:#9ca3af;">${echapper(c.linkText)}</a>${echapper(c.suffix)}`,
          )
          .join(" · ")}</p>`
      : "";

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <tr><td>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">${
        marches > 0
          ? "La marche du dessus, d'abord. Ces postes sont un cran au-dessus de votre niveau actuel — votre parcours montre que vous pouvez les défendre."
          : "Ce que le marché a pour vous cette semaine."
      }</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;">${lignesHtml}</table>
      <p style="margin:20px 0 0;">
        <a href="${echapper(tableauDeBordUrl)}" style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;text-decoration:none;padding:10px 16px;border-radius:8px;">Tout voir</a>
      </p>
      ${creditsHtml}
      <p style="color:#9ca3af;font-size:11px;margin:16px 0 0;line-height:1.5;">
        Nous ne postulons jamais en votre nom. Chaque lien mène à l'annonce d'origine, chez l'employeur.<br>
        <a href="${echapper(desabonnementUrl)}" style="color:#9ca3af;">Se désabonner</a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { objet, html, texte };
}
