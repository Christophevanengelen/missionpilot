"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
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
export function LoginForm() {
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
  );
}
