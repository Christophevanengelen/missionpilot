"use client";

import { useState, useTransition } from "react";
import { ecarterOffreAction } from "@/lib/ecartement/actions";
import { t } from "@/lib/copy";
import { MOTIFS, type Motif } from "@/lib/ecartement/motifs";

/**
 * « Pas pour moi » — le seul geste que le produit apprend d'une offre.
 *
 * CE QU'IL RÉPARE. Jusqu'ici, la seule action possible sur une annonce était
 * de la suivre vers sa plateforme. Quelqu'un à qui le moteur sert douze offres
 * à côté de la plaque n'avait aucun moyen de le dire : il partait, et le
 * tableau de pilotage affichait « jamais revenu » — un chiffre qui signale
 * qu'un problème existe sans jamais dire lequel.
 *
 * DÉCLARATIF, PAS OBSERVÉ. C'est la personne qui dit ce qui ne va pas ; on ne
 * regarde pas ce qu'elle clique. Cette distinction est ce qui permet d'avoir
 * un signal sans traceur, donc sans ligne supplémentaire dans la politique de
 * confidentialité au titre de la surveillance — seul le compteur de motifs y
 * est déclaré, et il ne désigne aucune offre.
 *
 * LE MENU EST LA CONFIRMATION, et il n'y a pas d'annulation. Un « Annuler »
 * supposerait de décrémenter, donc une seconde écriture, pour réparer un clic
 * dont le coût réel est d'une unité sur un compteur. Le diagnostic n'ouvre
 * qu'à partir de trois écartements convergents (`SEUIL_DIAGNOSTIC`) :
 * précisément pour qu'un clic malheureux ne conclue rien.
 */
export function PasPourMoi() {
  const copy = t().search.pasPourMoi;
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState<Motif | null>(null);
  const [enCours, demarrer] = useTransition();

  function ecarter(motif: Motif) {
    // L'état passe AVANT l'aller-retour : l'offre disparaît au clic, sans
    // attendre le serveur. Un compteur qui n'arrive pas ne mérite pas de
    // retenir quelqu'un devant une annonce qu'il vient de refuser.
    setChoisi(motif);
    demarrer(() => {
      void ecarterOffreAction(motif);
    });
  }

  if (choisi !== null) {
    return (
      <p
        role="status"
        className="text-muted-foreground border-border border-t pt-2 text-xs"
      >
        {copy.confirme[choisi]}
      </p>
    );
  }

  return (
    <div className="border-border flex flex-col gap-2 border-t pt-2">
      {ouvert ? (
        <>
          <p className="text-muted-foreground text-xs">{copy.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {MOTIFS.map((motif) => (
              <button
                key={motif}
                type="button"
                disabled={enCours}
                onClick={() => ecarter(motif)}
                className="border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground rounded-md border px-2.5 py-1 text-xs motion-safe:transition-colors disabled:opacity-60"
              >
                {copy.motifs[motif]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-expanded={false}
          className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2 motion-safe:transition-colors"
        >
          {copy.ouvrir}
        </button>
      )}
    </div>
  );
}
