"use client";

import { useState } from "react";
import { CvImport } from "../profile/cv-import";

/**
 * Le premier écran : UNE question, deux réponses.
 *
 * Ce qu'il remplace : un écran qui offrait quatre façons de commencer à la fois
 * — un champ PDF, une zone de collage, un champ d'archive LinkedIn et deux
 * boutons — à quelqu'un à qui on n'avait encore montré aucun résultat. Chaque
 * champ ajouté coûte de la complétion, et un premier écran est l'endroit où ce
 * coût est le plus élevé.
 *
 * Choisir n'est pas une étape du formulaire, c'est TOUTE l'étape : on prend un
 * chemin et seul celui-là apparaît. Le choix se défait en un clic, parce qu'un
 * premier écran qui enferme est pire qu'un écran qui demande deux fois.
 *
 * LE CHEMIN LINKEDIN A DEUX VISAGES, et c'est délibéré. Quand le flux OAuth est
 * branché, la personne clique et LinkedIn envoie son parcours. Sinon, elle
 * dépose son archive officielle — et l'écran la GUIDE jusqu'à elle au lieu de
 * la lâcher dans les réglages de LinkedIn. Le mot employé suit ce qui est
 * réellement possible : « Remplir avec LinkedIn » quand le bouton existe,
 * « Mon export LinkedIn » sinon. Promettre une connexion qui n'existe pas se
 * paie à la première utilisation.
 */

/** L'adresse directe de la page d'export de LinkedIn. Elle vaut mieux qu'un
 *  chemin de menus à suivre : entre « Préférences → Confidentialité des
 *  données → Obtenir une copie » et un lien, il y a tous ceux qui abandonnent. */
const EXPORT_LINKEDIN =
  "https://www.linkedin.com/mypreferences/d/download-my-data";

type Choix = "cv" | "linkedin";

function Carte({
  titre,
  detail,
  marque,
  onClick,
}: {
  titre: string;
  detail: string;
  marque: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-foreground/40 hover:bg-accent/40 group flex flex-col gap-2 rounded-xl border p-5 text-left motion-safe:transition-colors"
    >
      <span className="text-muted-foreground font-mono text-[0.66rem] tracking-[0.18em] uppercase">
        {marque}
      </span>
      <span className="text-lg font-medium tracking-tight">{titre}</span>
      <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {detail}
      </span>
    </button>
  );
}

export function OnboardingStart({
  linkedInPret = false,
}: { linkedInPret?: boolean } = {}) {
  const [choix, setChoix] = useState<Choix | null>(null);

  if (choix !== null) {
    return (
      <div className="flex flex-col gap-4">
        {/* Le guidage n'apparaît QUE sur le chemin de l'archive, et seulement
            quand le bouton n'existe pas : superposer trois étapes à un bouton
            d'un clic ferait douter de ce qu'on vient de cliquer. */}
        {choix === "linkedin" && !linkedInPret ? (
          <ol className="border-border bg-card text-muted-foreground flex flex-col gap-2 rounded-xl border p-5 text-sm">
            <li>
              <strong className="text-foreground font-medium">1.</strong>{" "}
              <a
                href={EXPORT_LINKEDIN}
                target="_blank"
                rel="noopener"
                className="text-foreground underline underline-offset-2"
              >
                Ouvrez la page d’export de LinkedIn
              </a>{" "}
              et demandez une copie de vos données.
            </li>
            <li>
              <strong className="text-foreground font-medium">2.</strong> Cochez
              au minimum{" "}
              <span className="text-foreground">
                Profil, Postes, Compétences, Formation
              </span>{" "}
              et surtout{" "}
              <span className="text-foreground">Recommandations</span> — c’est
              la seule pièce écrite par d’autres que vous, et celle qui dit
              l’ampleur réelle de vos missions.
            </li>
            <li>
              <strong className="text-foreground font-medium">3.</strong>{" "}
              LinkedIn vous envoie l’archive par e-mail, souvent en quelques
              minutes. Déposez-la ci-dessous.
            </li>
          </ol>
        ) : null}

        <CvImport only={choix} linkedInPret={linkedInPret} />

        <button
          type="button"
          onClick={() => setChoix(null)}
          className="text-muted-foreground self-start text-xs underline underline-offset-2"
        >
          Choisir l’autre méthode
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="start" className="flex flex-col gap-5">
      {/* Pas de paragraphe d'introduction ici : la page en affiche déjà un,
          juste au-dessus, qui dit exactement la même chose. Deux promesses
          identiques à trois centimètres l'une de l'autre ne rassurent pas
          deux fois — elles donnent l'impression qu'on meuble. */}
      <h2 id="start" className="text-2xl font-semibold tracking-tight">
        Par quoi commence-t-on ?
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Carte
          marque="Le plus rapide"
          titre="Mon CV"
          /* « lu, puis oublié » était la formulation la plus trompeuse du
             produit : le FICHIER est bien oublié, mais son texte intégral est
             transmis à OpenAI, aux États-Unis, sans anonymisation
             (`cv-ai.ts:88`). C'est ici qu'on décide de déposer son CV ou non —
             on ne peut pas décider sur une phrase qui rassure à faux. */
          detail="Un PDF, ou son texte collé. Le fichier n’est pas conservé ; son texte est transmis à OpenAI, aux États-Unis, pour en tirer votre parcours."
          onClick={() => setChoix("cv")}
        />
        <Carte
          marque="Le plus complet"
          titre={linkedInPret ? "Remplir avec LinkedIn" : "Mon export LinkedIn"}
          detail={
            linkedInPret
              ? "LinkedIn vous demande votre accord, puis nous envoie vos postes, formations et compétences. Vous relisez avant que quoi que ce soit soit retenu."
              : "Votre archive officielle. Elle contient vos recommandations — ce que d’autres ont écrit sur vous, et que votre CV n’a pas."
          }
          onClick={() => setChoix("linkedin")}
        />
      </div>
    </section>
  );
}
