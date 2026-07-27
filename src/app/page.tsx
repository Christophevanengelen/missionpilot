import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/auth/dal";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "MissionPilot — on vous fait monter d'une marche",
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
export default async function RootPage() {
  const session = await getSessionClaims();
  // Someone already signed in did not come here to read the pitch.
  if (session) redirect("/dashboard");
  return <Landing />;
}
