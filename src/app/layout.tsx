import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Fonts: system stacks defined in globals.css — no next/font/google, no
// build-time network fetch, no vendored font files (Codex review, J6).

export const metadata: Metadata = {
  title: {
    default: "MissionPilot",
    template: "%s · MissionPilot",
  },
  // The default description every page inherits. It described the product this
  // one replaced ("opportunity intelligence for senior freelancers"), so every
  // shared link carried the old pitch regardless of what the page said.
  description:
    "MissionPilot ne cherche pas un emploi à votre place : il vous fait monter d'une marche. Déposez votre CV, et à chaque connexion découvrez ce que le marché a pour vous — y compris le poste d'un cran au-dessus.",
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
