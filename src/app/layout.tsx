import type { Metadata } from "next";
import { env } from "@/lib/env";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Fonts: system stacks defined in globals.css — no next/font/google, no
// build-time network fetch, no vendored font files (Codex review, J6).

const DESCRIPTION =
  "MissionPilot ne cherche pas un emploi à votre place : il vous fait monter d'une marche. Déposez votre CV, et à chaque connexion découvrez ce que le marché a pour vous — y compris le poste d'un cran au-dessus.";

export const metadata: Metadata = {
  /**
   * SANS `metadataBase`, toute URL relative d'Open Graph reste relative — et
   * un réseau social qui reçoit `/opengraph-image` sans hôte n'affiche rien.
   * C'est la ligne qui fait la différence entre un lien collé sur LinkedIn qui
   * montre l'escalier du produit et un lien nu.
   */
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "MissionPilot — on vous fait monter d'une marche",
    template: "%s · MissionPilot",
  },
  applicationName: "MissionPilot",
  keywords: [
    "recherche d'emploi",
    "moteur de recherche d'emploi",
    "évolution de carrière",
    "trajectoire professionnelle",
    "offres d'emploi en temps réel",
    "freelance senior",
    "open source",
  ],
  authors: [{ name: "Productions Associées ASBL" }],
  /**
   * L'espace connecté n'a rien à faire dans un index — `robots.ts` le dit aux
   * explorateurs, ceci le redit page par page. Les deux, parce qu'un
   * robots.txt est une CONSIGNE quand la balise est une instruction : les
   * moteurs qui ignorent la première respectent souvent la seconde.
   */
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_BE",
    siteName: "MissionPilot",
    title:
      "On ne cherche pas un emploi à votre place. On vous fait monter d'une marche.",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "On vous fait monter d'une marche.",
    description: DESCRIPTION,
  },
  // The default description every page inherits. It described the product this
  // one replaced ("opportunity intelligence for senior freelancers"), so every
  // shared link carried the old pitch regardless of what the page said.
  description: DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The interface is written in French. Declaring `en` was not cosmetic: a
  // screen reader pronounces every French sentence with English phonetics,
  // which is the difference between usable and unusable for someone who relies
  // on one.
  return (
    <html lang="fr" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="bg-background text-foreground sr-only rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
