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
 * exporte elle-même — et l'écran la GUIDE jusqu'au fichier au lieu de la
 * lâcher dans les réglages de LinkedIn. Le mot employé suit ce qui est
 * réellement possible : « Remplir avec LinkedIn » quand le bouton existe,
 * « Mon profil LinkedIn » sinon. Promettre une connexion qui n'existe pas se
 * paie à la première utilisation.
 *
 * DEPUIS LE 2026-08-01, LE SECOND VISAGE EST LE SEUL. LinkedIn a refusé
 * l'accès aux données de parcours (« Identity vetting failed » : la page
 * associée à l'app n'appartient pas à une entité déposée). Le flux OAuth reste
 * en place derrière son interrupteur, mais il est éteint et personne n'attend
 * qu'il revienne — c'est l'export manuel qui porte le produit.
 */

/** L'adresse directe de la page d'export de LinkedIn. Elle vaut mieux qu'un
 *  chemin de menus à suivre : entre « Préférences → Confidentialité des
 *  données → Obtenir une copie » et un lien, il y a tous ceux qui abandonnent. */
const EXPORT_LINKEDIN =
  "https://www.linkedin.com/mypreferences/d/download-my-data";

/** `/in/me` redirige vers le profil de la personne connectée — on n'a donc
 *  besoin de connaître ni son identifiant public ni son nom. */
const PROFIL_LINKEDIN = "https://www.linkedin.com/in/me/";

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
          <div className="flex flex-col gap-3">
            {/* DEUX CHEMINS, ET LE RAPIDE D'ABORD. L'archive officielle arrive
                « en quelques minutes » par e-mail : elle sort la personne du
                produit au moment exact où elle venait de décider d'y entrer, et
                rien ne garantit qu'elle revienne. Le PDF se télécharge sans
                quitter la page. On garde l'archive dessous, parce qu'elle porte
                les recommandations — mais on ne la met plus sur le chemin
                critique. */}
            <ol className="border-border bg-card text-muted-foreground flex flex-col gap-2 rounded-xl border p-5 text-sm">
              <li className="text-foreground mb-1 flex items-baseline gap-2 font-medium">
                <span>Le plus rapide — le PDF de votre profil</span>
                <span className="text-muted-foreground text-xs font-normal">
                  environ 30 secondes
                </span>
              </li>
              <li>
                <strong className="text-foreground font-medium">1.</strong>{" "}
                <a
                  href={PROFIL_LINKEDIN}
                  target="_blank"
                  rel="noopener"
                  className="text-foreground underline underline-offset-2"
                >
                  Ouvrez votre profil LinkedIn
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground font-medium">2.</strong> Sous
                votre photo, cliquez{" "}
                <span className="text-foreground">Plus</span>, puis{" "}
                <span className="text-foreground">
                  Enregistrer au format PDF
                </span>
                .
              </li>
              <li>
                <strong className="text-foreground font-medium">3.</strong> Le
                fichier se télécharge immédiatement. Déposez-le ci-dessous.
              </li>
            </ol>

            <details className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
              <summary className="text-foreground cursor-pointer font-medium">
                Le plus complet — l’archive officielle{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  quelques minutes, par e-mail
                </span>
              </summary>
              <ol className="mt-3 flex flex-col gap-2">
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
                  <strong className="text-foreground font-medium">2.</strong>{" "}
                  Cochez au minimum{" "}
                  <span className="text-foreground">
                    Profil, Postes, Compétences, Formation
                  </span>{" "}
                  et surtout{" "}
                  <span className="text-foreground">Recommandations</span> —
                  c’est la seule pièce écrite par d’autres que vous, et celle
                  qui dit l’ampleur réelle de vos missions.
                </li>
                <li>
                  <strong className="text-foreground font-medium">3.</strong>{" "}
                  LinkedIn vous envoie l’archive par e-mail, souvent en quelques
                  minutes. Déposez-la dans le second champ ci-dessous.
                </li>
              </ol>
            </details>
          </div>
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
          /* « Le plus complet » décrivait l'archive officielle, qui n'est plus
             le chemin proposé en premier. La marque dit maintenant l'avantage
             réel de ce chemin : il ne suppose pas qu'on sache où est son CV,
             ni qu'il soit à jour. */
          marque="Sans chercher son CV"
          titre={linkedInPret ? "Remplir avec LinkedIn" : "Mon profil LinkedIn"}
          detail={
            linkedInPret
              ? "LinkedIn vous demande votre accord, puis nous envoie vos postes, formations et compétences. Vous relisez avant que quoi que ce soit soit retenu."
              : "Le PDF de votre profil, en trois clics — on vous montre où le prendre. Votre profil est souvent plus à jour que votre CV."
          }
          onClick={() => setChoix("linkedin")}
        />
      </div>
    </section>
  );
}
