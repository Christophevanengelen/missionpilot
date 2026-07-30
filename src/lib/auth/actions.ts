"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { env } from "@/lib/env";

const emailSchema = z.object({ email: z.string().trim().email() });

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignInState = {
  error: string | null;
  /** Le lien est parti : l'écran doit alors parler de la boîte mail, plus du
   *  formulaire. Un champ qui reste actif après l'envoi invite à recliquer, et
   *  chaque clic consomme une place sous le plafond d'envoi. */
  envoye?: boolean;
};

/**
 * Connexion par LIEN MAGIQUE — la porte d'entrée principale.
 *
 * Pourquoi elle remplace le mot de passe : la personne arrive ici pour savoir
 * ce que le marché a pour elle, pas pour inventer un mot de passe de plus.
 * Chaque champ entre elle et la première réponse coûte des gens, et le premier
 * écran est l'endroit où ce coût est le plus élevé.
 *
 * `emailRedirectTo` DOIT pointer vers une route publique, sinon le proxy
 * intercepte le retour avant qu'une session existe et renvoie la personne vers
 * la connexion — elle cliquerait sur son lien pour retomber là d'où elle vient,
 * sans une ligne d'explication. Voir PUBLIC_PATHS dans proxy-session.ts.
 */
export async function envoyerLienMagique(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Entrez une adresse e-mail valide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: new URL(
        "/auth/confirm",
        env.NEXT_PUBLIC_APP_URL,
      ).toString(),
    },
  });

  if (error) {
    // On ne dit JAMAIS si l'adresse est déjà connue : ce serait offrir un
    // moyen de savoir qui a un compte ici. Le seul cas distingué est le
    // plafond d'envoi, parce qu'il se résout en attendant et que le taire
    // laisserait la personne recliquer dans le vide.
    const plafond = /rate limit|too many/i.test(error.message);
    return {
      error: plafond
        ? // « Réessayez dans quelques minutes » était faux, et coûteux :
          // le service d'envoi intégré de Supabase plafonne à deux e-mails
          // PAR HEURE. Quelqu'un qui suit ce conseil recliquera trois minutes
          // plus tard, se fera refuser à nouveau, et conclura que le produit
          // est cassé — c'est exactement ce qui s'est produit. Un délai annoncé
          // trop court est pire que pas de délai du tout : il transforme une
          // attente en panne apparente.
          //
          // À corriger le jour où le SMTP personnalisé est branché : ce plafond
          // disparaît alors, et cette phrase devient fausse dans l'autre sens.
          "Trop de liens demandés. Notre service d’envoi est plafonné à deux e-mails par heure — réessayez dans une heure."
        : null,
      envoye: !plafond,
    };
  }

  return { error: null, envoye: true };
}

/**
 * Connexion par mot de passe — conservée, mais reléguée.
 *
 * Elle n'est pas là par nostalgie : tant qu'aucun service d'envoi n'est
 * branché, le service intégré de Supabase plafonne à deux e-mails par heure.
 * Sans cette porte de secours, une panne d'e-mail enfermerait dehors ceux qui
 * ont déjà un compte — à commencer par l'administrateur.
 */
export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Entrez une adresse e-mail valide et votre mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Assaini : ne jamais répercuter les détails du fournisseur, et ne jamais
    // distinguer un mot de passe faux d'un compte inconnu.
    return { error: "E-mail ou mot de passe incorrect." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Connexion par un fournisseur d'identité — Google ou LinkedIn, en un clic.
 *
 * CE QUE ÇA CHANGE, ET CE QUE ÇA NE CHANGE PAS. Le lien magique demande un
 * aller-retour par la boîte mail ; pour qui vit dans son navigateur avec une
 * session Google ouverte, c'est une friction au seul endroit où elle coûte des
 * gens. Le fournisseur ne remplace rien : il est un troisième chemin vers la
 * même session Supabase, et tout le reste — profil, RLS, effacement — est
 * strictement identique quel que soit le chemin d'entrée.
 *
 * L'ACTION EST CÔTÉ SERVEUR, et ce n'est pas un détail : avec `@supabase/ssr`,
 * `signInWithOAuth` pose ici le cookie du vérificateur PKCE que le retour
 * (`/auth/confirm`, déjà public, déjà capable d'échanger un `code`) viendra
 * comparer. Lancer le flux depuis le navigateur casserait cet appariement.
 *
 * CHAQUE FOURNISSEUR EST GARDÉ DEUX FOIS : le bouton n'existe pas sans
 * l'interrupteur, et l'action revérifie l'interrupteur — un POST forgé sur une
 * action désactivée doit être un non-événement, pas un départ vers un écran
 * d'erreur Google.
 */
async function connexionParFournisseur(
  fournisseur: "google" | "linkedin_oidc",
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: fournisseur,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      // `consent` n'est PAS demandé : re-forcer l'écran d'autorisation à
      // chaque connexion punirait précisément les gens qui reviennent.
    },
  });
  if (error || !data?.url) {
    // Fournisseur configuré à moitié (interrupteur allumé, Supabase pas
    // prêt) : on revient à l'écran de connexion, où le lien magique marche.
    redirect("/login");
  }
  redirect(data.url);
}

export async function connexionGoogle(): Promise<void> {
  if (env.AUTH_GOOGLE_ENABLED !== true) redirect("/login");
  await connexionParFournisseur("google");
}

export async function connexionLinkedIn(): Promise<void> {
  if (env.AUTH_LINKEDIN_ENABLED !== true) redirect("/login");
  await connexionParFournisseur("linkedin_oidc");
}
