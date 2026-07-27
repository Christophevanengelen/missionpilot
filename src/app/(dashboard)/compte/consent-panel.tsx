"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { retirerConsentementArt9Action } from "@/lib/profile/cv-actions";

/**
 * L'état du consentement de l'article 9, et son retrait.
 *
 * Le retrait est un DROIT (art. 7(3)), et le texte est explicite : il doit être
 * aussi simple à exercer qu'à donner. Un bouton, aucune justification demandée,
 * aucune tentative de retenir — pas de « êtes-vous sûr ? », pas de rappel de ce
 * qu'on perd.
 *
 * Ce que le retrait fait, et ce qu'il ne fait pas, est dit sans arrondir : il
 * vaut pour l'avenir. Ce que le modèle a déjà lu a déjà été lu ; les
 * affirmations qui en sont issues restent dans le profil, où la personne peut
 * les rejeter une par une, et disparaissent avec le compte. Prétendre l'inverse
 * serait plus confortable et faux.
 */
export function ConsentPanel({ donneLe }: { donneLe: string | null }) {
  const [retire, setRetire] = useState(false);
  const [echec, setEchec] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const enCours = useRef(false);
  const router = useRouter();

  async function retirer() {
    if (enCours.current) return;
    enCours.current = true;
    setOccupe(true);
    setEchec(false);
    try {
      const res = await retirerConsentementArt9Action();
      if (res.ok) {
        setRetire(true);
        router.refresh();
      } else {
        setEchec(true);
      }
    } catch {
      setEchec(true);
    } finally {
      enCours.current = false;
      setOccupe(false);
    }
  }

  const actif = donneLe !== null && !retire;

  return (
    <section
      aria-labelledby="consentement"
      className="border-border flex flex-col gap-3 border-t pt-8"
    >
      <h2 id="consentement" className="text-lg font-semibold">
        Lecture des informations sensibles de votre CV
      </h2>

      {actif ? (
        <>
          <p className="text-muted-foreground text-pretty">
            Vous avez donné votre accord le{" "}
            {new Date(donneLe).toLocaleDateString("fr-BE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Il nous permet de lire un CV qui contiendrait une information
            protégée — santé, origine, convictions, appartenance syndicale.
          </p>
          <p className="text-muted-foreground text-pretty">
            Le retirer vaut pour l’avenir : nous ne lirons plus de nouveau CV
            tant que vous ne l’aurez pas redonné. Ce que le modèle a déjà lu a
            déjà été lu ; les affirmations qui en sont issues restent dans votre
            profil, où vous pouvez les rejeter une par une, et disparaissent
            avec votre compte.
          </p>
          <div>
            <Button
              onClick={retirer}
              variant="outline"
              aria-busy={occupe}
              className={occupe ? "pointer-events-none opacity-60" : undefined}
            >
              Retirer mon accord
            </Button>
          </div>
        </>
      ) : (
        <p role={retire ? "status" : undefined} className="text-muted-foreground text-pretty">
          {retire
            ? "Votre accord est retiré. Nous ne lirons plus de nouveau CV tant que vous ne l’aurez pas redonné — la case vous sera reproposée au prochain dépôt."
            : "Vous n’avez pas donné cet accord. Nous ne lisons donc aucun CV : la case vous sera proposée au moment du dépôt."}
        </p>
      )}

      {echec ? (
        <p role="alert" className="text-sm">
          Le retrait n’a pas abouti. Votre accord est inchangé — réessayez.
        </p>
      ) : null}
    </section>
  );
}
