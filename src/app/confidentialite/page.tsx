import { LegalDocument } from "@/components/legal-document";

/* Statique : le document est lu au build, jamais à l'exécution. Une politique
   de confidentialité doit rester lisible même si la base est indisponible —
   c'est précisément le moment où quelqu'un pourrait vouloir la consulter. */
export const dynamic = "force-static";

export const metadata = {
  title: "Politique de confidentialité",
  description:
    "Ce que MissionPilot fait de vos données, écrit contre le code et non contre un modèle.",
};

export default function ConfidentialitePage() {
  return <LegalDocument fichier="politique-de-confidentialite.md" />;
}
