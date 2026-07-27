"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { exporterMesDonneesAction } from "@/lib/account/actions";

type Etat =
  | { phase: "repos" }
  | { phase: "preparation" }
  | { phase: "pret"; filename: string; href: string }
  | { phase: "erreur" };

/**
 * Emporter ses données.
 *
 * ON N'AFFIRME JAMAIS « le téléchargement a démarré ». Le clic synthétique a
 * lieu APRÈS un `await`, donc hors de la fenêtre de geste utilisateur, et
 * plusieurs navigateurs le suppriment sans rien dire. On prépare le fichier, on
 * annonce qu'il est prêt, et on laisse un vrai lien que la personne clique
 * elle-même — un lien qui existe vaut mieux qu'un téléchargement qu'on prétend
 * avoir lancé.
 */
export function ExportPanel() {
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const enCours = useRef(false);

  async function preparer() {
    // Verrou synchrone : `disabled` arrive au rendu suivant, un double-clic
    // rapide passe entre les deux.
    if (enCours.current) return;
    enCours.current = true;
    setEtat({ phase: "preparation" });

    try {
      const res = await exporterMesDonneesAction();
      if (!res.ok) {
        setEtat({ phase: "erreur" });
        return;
      }
      const blob = new Blob([res.json], { type: "application/json" });
      setEtat({
        phase: "pret",
        filename: res.filename,
        href: URL.createObjectURL(blob),
      });
    } catch {
      setEtat({ phase: "erreur" });
    } finally {
      enCours.current = false;
    }
  }

  const occupe = etat.phase === "preparation";

  return (
    <section aria-labelledby="export" className="flex flex-col gap-4">
      <h2 id="export" className="text-lg font-semibold">
        Emporter vos données
      </h2>
      <p className="text-muted-foreground text-pretty">
        Un fichier contenant tout ce que nos bases détiennent sur vous : votre
        profil et ses versions, vos éléments confirmés et vos preuves, vos
        préférences, les offres importées et leurs copies figées, vos suivis,
        les analyses écrites pour vous, et les traces techniques des agents
        lancés pour votre compte.
      </p>

      <div>
        <Button
          onClick={preparer}
          variant="outline"
          aria-busy={occupe}
          className={occupe ? "pointer-events-none opacity-60" : undefined}
        >
          Télécharger mes données (JSON)
        </Button>
      </div>

      {etat.phase === "preparation" ? (
        <p role="status" className="text-muted-foreground text-sm">
          Préparation de votre fichier…
        </p>
      ) : null}

      {etat.phase === "pret" ? (
        <p role="status" className="text-sm">
          Fichier prêt : {etat.filename}.{" "}
          <a
            href={etat.href}
            download={etat.filename}
            className="underline underline-offset-4"
          >
            Enregistrer le fichier
          </a>
        </p>
      ) : null}

      {etat.phase === "erreur" ? (
        <p role="alert" className="text-sm">
          Le fichier n’a pas pu être préparé. Vos données n’ont pas été
          modifiées — réessayez.
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs text-pretty">
        Le fichier arrive en clair sur votre ordinateur. Rangez-le comme vous
        rangeriez votre CV.
      </p>
    </section>
  );
}
