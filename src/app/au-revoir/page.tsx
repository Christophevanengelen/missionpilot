import Link from "next/link";
import { lireTemoinAdieu } from "@/lib/account/actions";

export const metadata = {
  title: "Au revoir",
  robots: { index: false },
};

/**
 * L'écran d'après.
 *
 * Route PUBLIQUE, hors du groupe (dashboard) : on y arrive précisément quand le
 * compte n'existe plus. Protégée, elle renverrait vers la connexion la personne
 * qui vient de tout supprimer.
 *
 * POURQUOI PAS `/login?compte=supprime` : d'abord parce que `login/page.tsx`
 * commence par rediriger toute session valide vers le tableau de bord — si
 * l'effacement du cookie avait échoué, la personne atterrirait sur un tableau
 * de bord dont le profil n'existe plus, donc sur une page d'erreur. Ensuite
 * parce qu'un paramètre d'URL rend le bandeau falsifiable par n'importe qui, sur
 * le domaine authentique.
 *
 * Le témoin est un cookie httpOnly posé par la suppression. Sans lui, la page
 * n'affirme RIEN : elle ne sait pas qui vous êtes — c'est voulu — donc elle ne
 * peut pas confirmer un effacement qu'elle n'a pas constaté.
 */
export default async function AuRevoirPage() {
  const confirme = await lireTemoinAdieu();

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 px-6 py-20">
      {confirme ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            Votre compte a été supprimé.
          </h1>
          <p className="text-muted-foreground text-pretty">
            Nos bases n’en contiennent plus rien : votre profil, vos versions,
            vos offres, vos analyses, vos suivis, vos traces d’exécution et
            votre journal d’authentification ont été effacés dans la même
            opération.
          </p>
          <p className="text-muted-foreground text-pretty">
            Restent seulement les éléments décrits avant la suppression : nos
            sauvegardes, les journaux de notre hébergeur, et ce qui a été
            transmis à nos fournisseurs.
          </p>
          <p className="text-pretty">
            Si vous avez trouvé ce que vous cherchiez, c’était le but.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            Suppression de compte
          </h1>
          <p className="text-muted-foreground text-pretty">
            Cette page confirme une suppression lorsqu’elle vient d’avoir lieu.
            Elle ne sait pas qui vous êtes, et c’est voulu : elle ne peut donc
            rien affirmer ici.
          </p>
          <p className="text-muted-foreground text-pretty">
            Si vous venez de demander une suppression, rouvrez l’application :
            si l’on vous demande de vous connecter, votre session a bien été
            fermée. Ne demandez pas de nouveau lien de connexion pour vérifier —
            une nouvelle demande créerait un compte vide.
          </p>
        </>
      )}

      <p>
        <Link href="/" className="underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </p>
    </main>
  );
}
