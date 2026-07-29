import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/db/admin";
import { desabonnerParJeton } from "@/lib/digest/abonnement";

export const metadata: Metadata = {
  title: "Se désabonner",
  // Une page atteinte par un lien d'e-mail n'a rien à faire dans un index.
  robots: { index: false, follow: false },
};

/**
 * Partir, sans se connecter.
 *
 * LA RÈGLE QUI TIENT CETTE PAGE : la sortie doit être plus facile que le
 * bouton « spam ». Demander une authentification à quelqu'un qui veut arrêter
 * de recevoir des e-mails, c'est une porte fermée à clé de l'intérieur — et la
 * conséquence n'est pas qu'il reste abonné, c'est qu'il nous signale, ce qui
 * abîme la délivrabilité du domaine entier, liens de connexion compris.
 *
 * Le jeton ne donne accès à RIEN d'autre : il désabonne, il n'ouvre aucune
 * donnée et n'authentifie personne. Au pire, un jeton volé désabonne sa
 * victime — une nuisance, jamais une fuite.
 *
 * AUCUNE ADRESSE N'EST AFFICHÉE, même en cas de succès. Confirmer « vous êtes
 * désabonné, alice@exemple.fr » transformerait un lien deviné en oracle
 * d'existence de compte. On confirme l'action, jamais la personne.
 */
export default async function DesabonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;
  const resultat =
    typeof jeton === "string" && jeton !== ""
      ? await desabonnerParJeton(createServiceClient(), jeton)
      : { trouve: false };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {resultat.trouve ? "C'est fait." : "Ce lien n'est plus valable"}
      </h1>
      <p className="text-muted-foreground text-sm text-pretty">
        {resultat.trouve
          ? "Vous ne recevrez plus le récapitulatif hebdomadaire. Votre compte et votre profil ne changent pas : rien n'a été supprimé, et vous pouvez réactiver l'envoi à tout moment depuis votre compte."
          : "Il a peut-être déjà servi, ou le lien a été tronqué par votre logiciel de messagerie. Vous pouvez couper l'envoi depuis votre compte, une fois connecté."}
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/compte" className="underline underline-offset-2">
          Gérer mes envois
        </Link>
        <Link
          href="/"
          className="text-muted-foreground underline underline-offset-2"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
