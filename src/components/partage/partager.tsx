"use client";

import { useState } from "react";
import { chargeNative, lienReseau, type Reseau } from "@/lib/partage/liens";

/**
 * « Partager MissionPilot » — le seul mécanisme de recommandation du produit.
 *
 * DEUX SURFACES POUR UN GESTE, et ce n'est pas de la sur-ingénierie : sur
 * téléphone, `navigator.share` ouvre la feuille du système, qui connaît les
 * applications réellement installées — proposer une liste fixe à la place
 * afficherait X à quelqu'un qui partage par WhatsApp. Sur ordinateur, cette
 * API n'existe pas dans la plupart des navigateurs, et le repli n'est pas une
 * dégradation : c'est le chemin normal.
 *
 * LE LIEN AVANT LES RÉSEAUX, dans l'ordre d'affichage comme dans l'intention.
 * Recommander un outil se fait le plus souvent dans une conversation privée —
 * un message à un collègue, pas une publication. Mettre « copier le lien » en
 * premier suit ce que les gens font, au lieu de supposer que tout partage est
 * public.
 *
 * CE QU'IL NE PARTAGE PAS : rien de la personne. Voir `liens.ts` — aucune
 * fonction du module ne prend de profil ni d'offre, et ce composant ne reçoit
 * qu'une URL publique.
 */

const RESEAUX: { cle: Reseau; nom: string }[] = [
  { cle: "linkedin", nom: "LinkedIn" },
  { cle: "bluesky", nom: "Bluesky" },
  { cle: "x", nom: "X" },
  { cle: "email", nom: "E-mail" },
];

export function Partager({
  url,
  ton = "clair",
}: {
  url: string;
  /** `encre` sur le fond sombre de la page publique, `clair` partout ailleurs.
   *  Le plan encre ne suit pas les jetons de thème — il les fixe. */
  ton?: "clair" | "encre";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);

  const encre = ton === "encre";
  const bouton = encre
    ? "border-[oklch(0.97_0.005_85_/_20%)] text-[oklch(0.97_0.005_85_/_72%)] hover:border-[oklch(0.97_0.005_85_/_38%)]"
    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground";

  async function partager() {
    // `navigator.share` n'existe pas partout, et lance quand la personne
    // referme la feuille sans choisir. Ce n'est pas une erreur : c'est un
    // refus, et un refus n'a rien à annoncer.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(chargeNative(url));
        return;
      } catch {
        return;
      }
    }
    setOuvert((o) => !o);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2400);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission bloquée) :
      // on ne prétend pas avoir copié. Le lien reste sélectionnable à l'œil.
      setCopie(false);
    }
  }

  return (
    /* Le repère sert une assertion précise : vérifier que CE panneau ne
       contient rien de la personne. Viser `main` ferait échouer le test sur
       la promesse légitime de la page d'accueil (« Déposez votre CV »), et un
       test faux finit désactivé — avec la garantie qu'il portait. */
    <div data-testid="partage" className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void partager()}
        aria-expanded={ouvert}
        className={`self-start rounded-md border px-4 py-2 text-sm font-medium motion-safe:transition-colors ${bouton}`}
      >
        Partager MissionPilot
      </button>

      {ouvert ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copier()}
              className={`rounded-md border px-3 py-1.5 text-xs motion-safe:transition-colors ${bouton}`}
            >
              {copie ? "Lien copié" : "Copier le lien"}
            </button>
            {RESEAUX.map((r) => (
              <a
                key={r.cle}
                href={lienReseau(r.cle, url)}
                target="_blank"
                rel="noopener"
                className={`rounded-md border px-3 py-1.5 text-xs motion-safe:transition-colors ${bouton}`}
              >
                {r.nom}
              </a>
            ))}
          </div>
          {/* Annoncé aux lecteurs d'écran, pas seulement coloré : « Lien
              copié » qui ne change qu'un libellé visuel ne dit rien à qui
              n'regarde pas le bouton. */}
          <p aria-live="polite" className="sr-only">
            {copie ? "Lien copié dans le presse-papiers." : ""}
          </p>
          <p
            className={`text-xs text-pretty ${encre ? "text-[oklch(0.97_0.005_85_/_55%)]" : "text-muted-foreground"}`}
          >
            Vous partagez l’outil, jamais votre recherche : rien de votre
            parcours ni des offres que vous regardez ne quitte cette page.
          </p>
        </div>
      ) : null}
    </div>
  );
}
