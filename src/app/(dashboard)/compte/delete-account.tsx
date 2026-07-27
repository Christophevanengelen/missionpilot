"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supprimerCompteAction } from "@/lib/account/actions";

type Issue =
  | { type: "aucune" }
  | { type: "succes" }
  | { type: "echec" }
  | { type: "blocage"; ref?: string }
  | { type: "inconnu" };

/**
 * L'acte le plus irréversible du produit.
 *
 * Panneau en deux temps plutôt que fenêtre modale : le déclencheur est REMPLACÉ
 * par la confirmation, donc le bouton destructeur n'apparaît jamais à l'endroit
 * que le doigt visait. « Annuler » vient en premier dans le DOM et en bouton
 * plein ; la suppression vient en dernier, en contour. On ne fait pas taper un
 * mot : il serait dans le bundle client, sans effet contre un script, et sans
 * effet non plus contre une requête forgée — ce n'est pas un contrôle, c'est
 * une cérémonie.
 *
 * Cinq issues distinctes, jamais confondues. La plus délicate est « inconnu » :
 * quand le transport échoue, on ne sait pas si la suppression a eu lieu, et le
 * dire est plus utile que de deviner.
 */
export function DeleteAccount({ nonInclus }: { nonInclus: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [issue, setIssue] = useState<Issue>({ type: "aucune" });
  const [occupe, setOccupe] = useState(false);
  const enCours = useRef(false);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();

  function ouvrir() {
    setOuvert(true);
    setIssue({ type: "aucune" });
    // Le focus va sur le TITRE du panneau, pas sur un bouton : ce qui compte
    // ici est ce qu'on lit, pas ce qu'on peut appuyer.
    requestAnimationFrame(() => titreRef.current?.focus());
  }

  async function supprimer() {
    if (enCours.current) return;
    enCours.current = true;
    setOccupe(true);

    try {
      const res = await supprimerCompteAction({ confirmation: true });
      if (res.ok) {
        setIssue({ type: "succes" });
        router.replace("/au-revoir");
        return;
      }
      if (res.error === "blocked") setIssue({ type: "blocage", ref: res.ref });
      else if (res.error === "unknown") setIssue({ type: "inconnu" });
      else setIssue({ type: "echec" });
    } catch {
      // Le transport a lâché : la décision du serveur nous est inconnue.
      setIssue({ type: "inconnu" });
    } finally {
      enCours.current = false;
      setOccupe(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <Button onClick={ouvrir} variant="outline">
            Supprimer mon compte
          </Button>
        </div>
        {issue.type !== "aucune" ? <Message issue={issue} /> : null}
      </div>
    );
  }

  return (
    <div className="border-border flex flex-col gap-4 rounded-md border p-5">
      <h3
        ref={titreRef}
        tabIndex={-1}
        className="text-base font-semibold outline-none"
      >
        Supprimer définitivement votre compte
      </h3>

      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Ce qui est effacé de nos bases, immédiatement et sans retour :
        </p>
        <ul className="text-muted-foreground list-disc pl-5 text-sm">
          <li>
            votre profil, ses versions publiées, vos éléments confirmés et vos
            preuves ;
          </li>
          <li>
            vos préférences, vos offres importées et leurs copies figées, vos
            suivis et vos notes ;
          </li>
          <li>
            les analyses écrites pour vous : correspondances, décompositions,
            brouillons de lettres, préparations d’entretien ;
          </li>
          <li>vos réponses de clarification ;</li>
          <li>les traces d’exécution des agents lancés pour votre compte ;</li>
          <li>
            votre identité de connexion : e-mail, sessions, appareils, et le
            journal d’authentification qui conserve vos adresses IP.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Ce que nous ne pouvons pas effacer, et pourquoi :
        </p>
        <ul className="text-muted-foreground list-disc pl-5 text-sm">
          {nonInclus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        Vous serez déconnecté de cet appareil. Nous ne restaurerons rien, y
        compris si vous nous le demandez ensuite. Fermer ce panneau ne supprime
        rien.
      </p>

      {issue.type !== "aucune" ? <Message issue={issue} /> : null}

      {/* « Annuler » d'abord dans le DOM et en bouton plein : c'est l'issue
          sûre, et c'est celle que le clavier atteint en premier. */}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          onClick={() => setOuvert(false)}
          aria-busy={occupe}
          className={occupe ? "pointer-events-none opacity-60" : undefined}
        >
          Annuler
        </Button>
        <Button
          onClick={supprimer}
          variant="outline"
          aria-busy={occupe}
          className={
            occupe
              ? "text-destructive pointer-events-none opacity-60"
              : "text-destructive"
          }
        >
          Supprimer définitivement mon compte
        </Button>
      </div>
    </div>
  );
}

function Message({ issue }: { issue: Issue }) {
  if (issue.type === "succes") {
    // Repli si la navigation client échoue : on rend le texte ET un lien en
    // dur, plutôt que de laisser quelqu'un sur un écran qui ne dit rien.
    return (
      <p role="status" className="text-sm">
        Votre compte a été supprimé.{" "}
        <a href="/au-revoir" className="underline underline-offset-4">
          Continuer
        </a>
      </p>
    );
  }
  if (issue.type === "echec") {
    return (
      <p role="alert" className="text-sm">
        La suppression n’a pas abouti. Votre compte et vos données n’ont pas été
        modifiés — réessayez.
      </p>
    );
  }
  if (issue.type === "blocage") {
    return (
      <p role="alert" className="text-sm text-pretty">
        La suppression n’a pas pu s’exécuter, et réessayer n’y changera rien.
        Votre compte et vos données n’ont pas été modifiés. Signalez-le en
        citant la référence ci-dessous.
        {issue.ref ? <> Référence : {issue.ref}</> : null}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-pretty">
      La connexion a été interrompue pendant la suppression : nous ne savons pas
      si elle a abouti. N’appuyez pas de nouveau tout de suite. Attendez une
      minute, puis rouvrez l’application : si l’on vous demande de vous
      connecter, la suppression a eu lieu ; si votre profil s’affiche
      normalement, elle n’a pas eu lieu. Ne demandez pas de nouveau lien de
      connexion pour vérifier — une nouvelle demande créerait un compte vide.
    </p>
  );
}
