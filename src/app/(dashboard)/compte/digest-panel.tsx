"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { definirDigestAction } from "@/lib/digest/actions";

/**
 * Le récapitulatif hebdomadaire : le demander, l'arrêter.
 *
 * OPT-IN STRICT. L'état initial est « non », et il le reste tant que personne
 * n'a cliqué. Ce n'est pas seulement la position RGPD : c'est la seule qui
 * soit cohérente avec un produit dont l'argument central est qu'il ne fait
 * rien en votre nom. Un envoi automatique qu'on n'a pas demandé serait la
 * première chose qu'il ferait sans qu'on le lui demande.
 *
 * Aucune tentative de retenir au moment d'arrêter — pas de « êtes-vous
 * sûr ? », pas de rappel de ce qu'on perd. Même règle que le retrait du
 * consentement de l'article 9, juste au-dessus, et pour la même raison :
 * arrêter doit être aussi simple que commencer.
 */
export function DigestPanel({ actifInitial }: { actifInitial: boolean }) {
  const [actif, setActif] = useState(actifInitial);
  const [echec, setEchec] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const enCours = useRef(false);
  const router = useRouter();

  async function basculer(vers: boolean) {
    if (enCours.current) return;
    enCours.current = true;
    setOccupe(true);
    setEchec(false);
    try {
      const res = await definirDigestAction(vers);
      if (res.ok) {
        setActif(vers);
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

  return (
    <section
      aria-labelledby="digest"
      className="border-border flex flex-col gap-3 border-t pt-8"
    >
      <h2 id="digest" className="text-lg font-medium">
        Le récapitulatif du lundi
      </h2>
      <p className="text-muted-foreground text-sm text-pretty">
        Une fois par semaine, nous cherchons pour vous et nous vous écrivons —{" "}
        <strong className="text-foreground font-medium">
          seulement si nous avons trouvé quelque chose
        </strong>
        . Pas de relance, pas de « vous nous manquez » : un e-mail vide ne
        prouve rien et coûte une ouverture.
      </p>
      <p className="text-muted-foreground text-sm">
        {actif
          ? "Vous le recevez le lundi matin. Chaque envoi porte un lien pour arrêter, sans avoir à vous connecter."
          : "Vous ne le recevez pas."}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={actif ? "outline" : "default"}
          disabled={occupe}
          onClick={() => basculer(!actif)}
        >
          {occupe
            ? "…"
            : actif
              ? "Arrêter les envois"
              : "Recevoir le récapitulatif"}
        </Button>
        {echec ? (
          <p role="alert" className="text-destructive text-sm">
            Je n&apos;ai pas pu enregistrer. Réessayez.
          </p>
        ) : null}
      </div>
    </section>
  );
}
