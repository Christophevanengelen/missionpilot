import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createLogger } from "@/lib/observability/logger";
import { TRAJECTORY_PROMPT_VERSION } from "@/lib/career/ai-trajectory";
import { VOCABULARY_PROMPT_VERSION } from "@/lib/search/ai-vocabulary";
import { bornerPlan, type ProfileSearchPlan } from "./plan-from-profile";

/**
 * Le plan de recherche, rangé quelque part qui survit à la requête.
 *
 * Un cache d'une heure EN MÉMOIRE existait déjà, et son commentaire promettait
 * qu'un dossier n'était lu qu'une fois par heure. Sur des fonctions serverless,
 * chaque instance froide repart vide : en production, c'était trois appels de
 * modèle à chaque visite, mesurés entre 10 et 22 secondes le 2026-07-29.
 *
 * Ce module ne calcule rien. Il lit, il écrit, et il sait dire si ce qu'il a
 * est encore valable — c'est tout, et c'est ce qui le rend testable sans
 * modèle.
 */

type Client = SupabaseClient<Database>;

const log = createLogger({ module: "plan-store" });

/**
 * L'empreinte du dossier.
 *
 * SHA-256 plutôt qu'une date d'expiration : une durée se trompe dans les deux
 * sens — elle jette un plan encore juste, et elle conserve un plan devenu faux
 * à la seconde où la personne corrige son profil. Une empreinte, elle, ne se
 * trompe jamais.
 *
 * Le dossier est normalisé avant hachage : un espace en fin de ligne ne change
 * pas ce qu'on a compris de quelqu'un, et le faire recalculer trois appels de
 * modèle serait absurde.
 */
export function empreinteDossier(dossier: string, sel = ""): string {
  const normalise = dossier.replace(/[ \t]+$/gm, "").trim();
  // LE SEL PORTE CE QUI N'EST PAS DANS LE DOSSIER mais change le plan : à ce
  // jour, les motifs d'écartement. Sans lui, cliquer « pas pour moi » ne
  // recalculerait jamais rien — le dossier n'ayant pas bougé, l'empreinte non
  // plus — et la personne verrait éternellement le plan d'avant son retour.
  // Vide par défaut : une empreinte sans écartement est exactement celle
  // d'avant cette ligne, donc aucun plan existant n'est invalidé pour rien.
  const grain = sel.trim() === "" ? normalise : `${normalise}\n${sel.trim()}`;
  return createHash("sha256").update(grain, "utf8").digest("hex");
}

/**
 * Les versions de prompt qui ont produit un plan.
 *
 * Sans ce marqueur, améliorer un prompt laisserait tous les profils existants
 * sur l'ancien résultat pour toujours : le dossier n'a pas changé, donc
 * l'empreinte non plus. Le plan serait périmé sans que rien ne le signale.
 */
export function versionsPrompt(): string {
  return `${TRAJECTORY_PROMPT_VERSION}+${VOCABULARY_PROMPT_VERSION}`;
}

/**
 * `null` quand il n'y a rien d'utilisable — et l'appelant ne doit JAMAIS
 * attendre un calcul pour autant. C'est tout le contrat de cet écran : on rend
 * ce qu'on a tout de suite, on calcule pour la prochaine fois.
 */
export async function lirePlanPrecalcule(
  client: Client,
  profileId: string,
  dossier: string,
  sel = "",
): Promise<ProfileSearchPlan | null> {
  const { data, error } = await client
    .from("profile_search_plans")
    .select("plan, dossier_hash, prompt_versions")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) return null;
  // Les deux conditions comptent autant l'une que l'autre : le dossier dit
  // « ce plan parle-t-il encore de cette personne », les versions disent
  // « a-t-il été produit par le raisonnement qu'on emploie aujourd'hui ».
  if (data.dossier_hash !== empreinteDossier(dossier, sel)) return null;
  if (data.prompt_versions !== versionsPrompt()) return null;
  // Borné ICI, à la lecture, et non au calcul : la ligne écrite le 2026-07-29 à
  // 17h37 portait douze recherches et a fait taire le tableau de bord jusqu'à
  // ce soir-là. Borner à la lecture désarme les lignes DÉJÀ écrites, sans
  // attendre qu'un travail de fond veuille bien les recalculer.
  return bornerPlan(data.plan as unknown as ProfileSearchPlan);
}

/**
 * Écrit avec la clé secrète, hors RLS — il n'y a pas de session utilisateur
 * dans un travail de fond. Le contrôle compensatoire est que `profileId` vient
 * d'un événement dont la propriété a été vérifiée par l'appelant, jamais d'une
 * entrée libre.
 */
export async function ecrirePlanPrecalcule(
  admin: Client,
  profileId: string,
  dossier: string,
  plan: ProfileSearchPlan,
  sel = "",
): Promise<void> {
  const { error } = await admin.from("profile_search_plans").upsert(
    {
      profile_id: profileId,
      dossier_hash: empreinteDossier(dossier, sel),
      prompt_versions: versionsPrompt(),
      plan: plan as unknown as Database["public"]["Tables"]["profile_search_plans"]["Insert"]["plan"],
      computed_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) {
    // Un plan non écrit n'est pas une panne visible : la visite suivante
    // retombera sur le repli déterministe et redemandera un calcul. On le
    // journalise pour que ça ne devienne pas silencieusement permanent.
    log.error("plan précalculé non enregistré", { reason: error.message });
  }
}
