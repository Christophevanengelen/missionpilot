import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "MissionPilot — on vous fait monter d'une marche",
  /* L'adresse canonique, maintenant que la page est partageable : un lien
     recopié revient souvent avec la traînée de paramètres du réseau qui l'a
     servi (`?utm_source=…`, `?fbclid=…`). Sans cette ligne, un moteur y voit
     autant de pages distinctes que de variantes, et dilue entre elles le
     crédit qui devrait revenir à une seule. */
  alternates: { canonical: "/" },
  description:
    "Déposez votre CV. L'IA lit votre parcours comme une trajectoire et, à chaque connexion, vous montre ce que le marché a pour vous — y compris le poste d'un cran au-dessus. Aucune offre stockée, aucune candidature envoyée en votre nom.",
};

/**
 * The root: a real page for people who do not have an account, and a shortcut
 * for those who do.
 *
 * It used to redirect everyone to the sign-in box. That was right at the time —
 * the alternative was a second, stale landing page describing a product that no
 * longer existed — but a redirect is not an answer: someone arriving here has
 * been given no reason to hand over their career.
 */
/**
 * Ce que Google doit comprendre du produit — écrit une fois, en machine.
 *
 * Deux entités, et le choix est délibéré. `WebSite` donne le nom et la langue.
 * `SoftwareApplication` dit ce que c'est ET ce que ça coûte : `price: "0"` est
 * une affirmation vérifiable, pas un argument commercial — le produit est
 * gratuit et open source, et le dire en données structurées évite qu'un moteur
 * suppose le contraire.
 *
 * Ce qu'on n'écrit PAS : ni note d'utilisateurs, ni nombre d'avis. Ces champs
 * font briller un résultat de recherche avec des étoiles, et nous n'avons ni
 * l'un ni l'autre. Les inventer serait exactement le mensonge que le reste du
 * produit s'interdit — sur la seule surface que personne ne relit jamais.
 */
function donneesStructurees(base: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}#site`,
        url: base,
        name: "MissionPilot",
        inLanguage: "fr",
        description:
          "Moteur de recherche d'emploi open source qui lit votre parcours comme une trajectoire et vous montre le poste d'un cran au-dessus.",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}#app`,
        name: "MissionPilot",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: base,
        inLanguage: "fr",
        license: "https://www.gnu.org/licenses/agpl-3.0.html",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        description:
          "Déposez votre CV : l'IA lit votre parcours comme une trajectoire et, à chaque connexion, vous montre ce que le marché a pour vous — y compris le poste que vous n'auriez pas osé demander. Aucune offre stockée, aucune candidature envoyée en votre nom.",
      },
    ],
  };
}

export default async function RootPage() {
  const session = await getSessionClaims();
  // Someone already signed in did not come here to read the pitch.
  if (session) redirect("/dashboard");
  return (
    <>
      {/* `JSON.stringify` et non une chaîne écrite à la main : un guillemet mal
          échappé casse silencieusement le bloc entier, et personne ne le
          remarque avant de constater que le résultat de recherche est resté nu. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(donneesStructurees(env.NEXT_PUBLIC_APP_URL)),
        }}
      />
      <Landing />
    </>
  );
}
