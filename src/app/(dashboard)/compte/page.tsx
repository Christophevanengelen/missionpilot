import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { loadAccountFootprint } from "@/lib/account/logic";
import { lignesEmpreinte, NON_INCLUS } from "@/lib/account/export";
import { lireMonConsentementArt9 } from "@/lib/profile/cv-actions";
import { lireAbonnement } from "@/lib/digest/abonnement";
import { getOwnProfile } from "@/lib/opportunity/logic";
import { ExportPanel } from "./export-panel";
import { ConsentPanel } from "./consent-panel";
import { DigestPanel } from "./digest-panel";
import { DeleteAccount } from "./delete-account";

export const metadata = { title: "Vos données et votre compte" };

/**
 * L'écran des données.
 *
 * Il fait deux choses, et l'ordre compte : on peut EMPORTER ses données avant
 * de pouvoir les effacer. Quelqu'un qui vient supprimer son compte doit croiser
 * le téléchargement en chemin, sans qu'on le lui impose ni qu'on l'en dissuade.
 *
 * Le décompte est lu ici, côté serveur, à l'instant de l'affichage : annoncer
 * ce qui va disparaître avec des chiffres réels vaut mieux que « toutes vos
 * données », formule qui ne dit rien à personne.
 */
export default async function ComptePage() {
  const session = await verifySession();
  const client = await createClient();
  const empreinte = await loadAccountFootprint(client);
  const lignes = lignesEmpreinte(empreinte);
  const consentArt9 = await lireMonConsentementArt9();
  // Absent = jamais touché, ce qui vaut « non » pour l'affichage : personne ne
  // reçoit d'e-mail parce qu'on a décidé pour lui.
  const profile = await getOwnProfile(client);
  const abonnementDigest = await lireAbonnement(client, profile.id);

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Vos données et votre compte
        </h1>
        <p className="text-muted-foreground text-pretty">
          Ce que MissionPilot détient sur vous, comment l’emporter, et comment
          tout effacer.
        </p>
        <p className="text-muted-foreground text-sm">
          Compte : {session.email ?? "adresse inconnue"}
        </p>
      </header>

      <ExportPanel />

      <ConsentPanel donneLe={consentArt9} />

      <DigestPanel actifInitial={abonnementDigest?.optedIn ?? false} />

      <section
        aria-labelledby="suppression"
        className="border-border flex flex-col gap-4 border-t pt-8"
      >
        <h2 id="suppression" className="text-lg font-semibold">
          Supprimer mon compte
        </h2>
        <p className="text-muted-foreground text-pretty">
          Vous pouvez partir maintenant, sans le justifier.
        </p>

        {lignes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">À cet instant, votre compte contient :</p>
            <ul className="text-muted-foreground list-disc pl-5 text-sm">
              {lignes.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs text-pretty">
              Ce décompte est celui de cet instant : une recherche en cours peut
              encore ajouter des lignes, qui partiront avec le reste.
            </p>
          </div>
        ) : null}

        <DeleteAccount nonInclus={[...NON_INCLUS]} />
      </section>
    </div>
  );
}
