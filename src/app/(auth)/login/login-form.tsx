"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  connexionGoogle,
  connexionLinkedIn,
  envoyerLienMagique,
  signIn,
  type SignInState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = { error: null };

/**
 * Entrer, sans inventer un mot de passe de plus.
 *
 * On demande UNE chose — l'adresse — et le lien arrive. Quelqu'un vient ici
 * pour savoir ce que le marché a pour lui, pas pour fabriquer un secret qu'il
 * oubliera. Chaque champ entre cette personne et sa première réponse coûte des
 * gens, et un écran de connexion est l'endroit où ce coût est le plus élevé.
 *
 * LE MOT DE PASSE RESTE, mais replié. Il n'est pas là par nostalgie : tant
 * qu'aucun service d'envoi n'est branché, le service intégré plafonne à deux
 * e-mails par heure. Sans cette porte de secours, une panne d'e-mail
 * enfermerait dehors ceux qui ont déjà un compte.
 */
export function LoginForm({
  google = false,
  linkedin = false,
}: {
  /** Interrupteurs serveur (`AUTH_*_ENABLED`) : un bouton vers un fournisseur
   *  non configuré mènerait à une erreur au premier écran — le même piège que
   *  le bouton LinkedIn avant l'accord. */
  google?: boolean;
  linkedin?: boolean;
}) {
  const [lien, actionLien, lienEnCours] = useActionState(
    envoyerLienMagique,
    initialState,
  );
  const [motDePasse, actionMotDePasse, motDePasseEnCours] = useActionState(
    signIn,
    initialState,
  );
  const [passeVisible, setPasseVisible] = useState(false);
  const boutonRef = useRef<HTMLButtonElement>(null);

  // `disabled` pendant l'envoi fait tomber le focus clavier sur <body> : on le
  // rend quand une erreur s'affiche, sinon la personne qui navigue au clavier
  // ne sait pas où elle est.
  useEffect(() => {
    const erreur = lien.error ?? motDePasse.error;
    if (erreur && document.activeElement === document.body) {
      boutonRef.current?.focus();
    }
  }, [lien, motDePasse]);

  // Le lien est parti : l'écran parle de la boîte mail, plus du formulaire.
  // Laisser le champ actif inviterait à recliquer, et chaque clic consomme une
  // place sous le plafond d'envoi.
  if (lien.envoye) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="font-medium">Regardez votre boîte mail.</p>
        <p className="text-muted-foreground text-sm text-pretty">
          Nous venons d’envoyer un lien de connexion. Il est valable une heure,
          et il ouvre directement votre tableau de bord — aucun mot de passe à
          retenir.
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          Rien reçu au bout de deux minutes ? Regardez dans les indésirables :
          c’est là que finissent la plupart des liens de connexion.
        </p>
      </div>
    );
  }

  // UN SEUL formulaire, UN SEUL champ e-mail. Déplier le mot de passe
  // ajoutait un second champ e-mail juste en dessous du premier : on demandait
  // deux fois la même chose sur le même écran. L'action du formulaire change
  // selon le mode ; le champ, lui, ne bouge pas.
  const action = passeVisible ? actionMotDePasse : actionLien;
  const enCours = passeVisible ? motDePasseEnCours : lienEnCours;
  const erreur = passeVisible ? motDePasse.error : lien.error;

  return (
    <div className="flex flex-col gap-4">
      {/* Les fournisseurs d'abord : pour qui vit avec une session Google
          ouverte, c'est UN clic contre un aller-retour par la boîte mail.
          Chaque bouton est son propre <form> — un formulaire ne s'imbrique
          pas dans celui de l'e-mail, et chacun mène à une action distincte.
          Texte sans logo : les chartes de Google et LinkedIn encadrent
          strictement l'usage de leurs marques ; un bouton texte est lisible,
          conforme, et se passe de leur permission. */}
      {google || linkedin ? (
        <>
          <div className="flex flex-col gap-2">
            {google ? (
              <form action={connexionGoogle}>
                <Button type="submit" variant="outline" className="w-full">
                  Continuer avec Google
                </Button>
              </form>
            ) : null}
            {linkedin ? (
              <form action={connexionLinkedIn}>
                <Button type="submit" variant="outline" className="w-full">
                  Continuer avec LinkedIn
                </Button>
              </form>
            ) : null}
          </div>
          {/* Décoratif : le champ e-mail porte déjà son propre label. */}
          <div
            aria-hidden="true"
            className="text-muted-foreground flex items-center gap-3 text-xs"
          >
            <span className="bg-border h-px flex-1" />
            ou par e-mail
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      ) : null}

      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Votre e-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={erreur ? "login-error" : undefined}
          />
        </div>

        {passeVisible ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={erreur ? "login-error" : undefined}
            />
          </div>
        ) : null}

        {erreur ? (
          <p
            id="login-error"
            role="alert"
            className="text-destructive text-sm font-medium"
          >
            {erreur}
          </p>
        ) : null}

        <Button ref={boutonRef} type="submit" disabled={enCours}>
          {enCours
            ? passeVisible
              ? "Connexion…"
              : "Envoi…"
            : passeVisible
              ? "Entrer"
              : "Recevoir mon lien de connexion"}
        </Button>

        {passeVisible ? null : (
          <button
            type="button"
            onClick={() => setPasseVisible(true)}
            className="text-muted-foreground self-start text-xs underline underline-offset-2"
          >
            J’ai déjà un mot de passe
          </button>
        )}
      </form>
    </div>
  );
}
