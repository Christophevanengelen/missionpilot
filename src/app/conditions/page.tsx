import { LegalDocument } from "@/components/legal-document";

export const dynamic = "force-static";

export const metadata = {
  title: "Conditions générales d’utilisation",
  description:
    "Ce que MissionPilot est, ce qu’il n’est pas, et ce qu’il ne fera jamais à votre place.",
};

export default function ConditionsPage() {
  return <LegalDocument fichier="conditions-generales.md" />;
}
