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
        ? "Trop de liens demandés d’un coup. Réessayez dans quelques minutes."
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
