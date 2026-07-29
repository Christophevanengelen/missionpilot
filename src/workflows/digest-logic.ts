import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/db/admin";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import { loadLivingProfile, loadPreferences } from "@/lib/profile/logic";
import { loadAnswers } from "@/lib/profile/clarifications";
import { buildProfileDossier } from "@/lib/matching/insight-logic";
import { profileSignalsFromClaims } from "@/lib/matching/score";
import { lirePlanPrecalcule } from "@/lib/search/plan-store";
import { planDeRepli } from "@/lib/search/plan-from-profile";
import { configuredSources } from "@/lib/discovery/sources";
import { searchMarket } from "@/lib/search/market";
import { SEARCH_COUNTRIES, MAX_COUNTRIES_PER_SEARCH } from "@/domain/countries";
import { construireDigest, meritEnvoi } from "@/lib/digest/contenu";
import { envoyerCourriel, mailConfigure } from "@/lib/mail/resend";

/**
 * Le digest hebdomadaire : ce que le système a trouvé pendant qu'on ne le
 * regardait pas.
 *
 * C'est la moitié manquante de la promesse. Jusqu'ici le produit ne travaillait
 * que pendant qu'on l'avait sous les yeux ; fermez l'onglet, plus rien. Une
 * fois par semaine, il va voir, et il n'écrit QUE s'il a trouvé.
 *
 * LA MÊME RECHERCHE QUE L'ÉCRAN, littéralement `searchMarket`. Un digest qui
 * chercherait autrement finirait par promettre des offres que l'application ne
 * montre pas — et c'est le genre d'écart que personne ne remarque avant qu'un
 * utilisateur ne le signale.
 */

const log = createLogger({ module: "digest" });

export const digestEventSchema = z.object({
  userId: z.string().uuid(),
  profileId: z.string().uuid(),
  email: z.string().email(),
  unsubscribeToken: z.string().regex(/^[0-9a-f]{64}$/),
});

export type DigestEvent = z.infer<typeof digestEventSchema>;

/**
 * Sept jours, moins une marge.
 *
 * La marge existe parce qu'une exécution planifiée ne tombe jamais à la
 * seconde près : sans elle, un déclenchement à 8h01 une semaine et 7h59 la
 * suivante sauterait purement et simplement un envoi, et personne ne
 * comprendrait pourquoi la semaine a été muette.
 */
const INTERVALLE_MS = 6.5 * 24 * 60 * 60 * 1000;

export function doitEnvoyer(
  lastSentAt: string | null,
  maintenant: number,
): boolean {
  if (lastSentAt === null) return true;
  const dernier = Date.parse(lastSentAt);
  // Une date illisible ne doit pas bloquer quelqu'un pour toujours : on
  // considère qu'on ne sait pas, et « on ne sait pas » vaut « on envoie ».
  if (Number.isNaN(dernier)) return true;
  return maintenant - dernier >= INTERVALLE_MS;
}

/** Les destinataires du jour : abonnés, et pas déjà servis cette semaine. */
export async function destinatairesDuJour(): Promise<DigestEvent[]> {
  if (!mailConfigure()) {
    // Pas une erreur : c'est l'état normal tant que l'interrupteur est éteint.
    log.info("digest éteint — aucun destinataire");
    return [];
  }
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("digest_subscriptions")
    .select("profile_id, unsubscribe_token, last_sent_at")
    .eq("opted_in", true);

  if (error || !data) {
    log.error("liste des abonnés illisible");
    return [];
  }

  const maintenant = Date.now();
  const aServir = data.filter((l) => doitEnvoyer(l.last_sent_at, maintenant));
  if (aServir.length === 0) return [];

  // L'adresse vit dans `auth.users`, jamais recopiée dans `public` : une
  // adresse dupliquée est une adresse qui diverge, et c'est celle-là qu'on
  // finirait par utiliser.
  const { data: profils, error: erreurProfils } = await admin
    .from("candidate_profiles")
    .select("id, user_id")
    .in(
      "id",
      aServir.map((l) => l.profile_id),
    );
  if (erreurProfils || !profils) return [];

  const evenements: DigestEvent[] = [];
  for (const ligne of aServir) {
    const profil = profils.find((p) => p.id === ligne.profile_id);
    if (!profil) continue;
    const { data: utilisateur } = await admin.auth.admin.getUserById(
      profil.user_id,
    );
    const email = utilisateur?.user?.email;
    if (!email) continue;
    evenements.push({
      userId: profil.user_id,
      profileId: ligne.profile_id,
      email,
      unsubscribeToken: ligne.unsubscribe_token,
    });
  }
  return evenements;
}

/**
 * Un destinataire, un e-mail — ou rien du tout.
 *
 * `envoye: false` n'est PAS un échec : c'est le cas normal d'une semaine sans
 * rien à montrer. La date de dernier envoi n'est alors pas écrite, pour que la
 * semaine suivante reparte de zéro plutôt que d'attendre sept jours de plus.
 */
export async function envoyerDigest(
  evenement: DigestEvent,
): Promise<{ envoye: boolean; raison?: string }> {
  if (!mailConfigure()) return { envoye: false, raison: "eteint" };

  const admin = createServiceClient();
  const [living, preferences, clarifications] = await Promise.all([
    loadLivingProfile(admin, evenement.profileId),
    loadPreferences(admin, evenement.profileId),
    loadAnswers(admin, evenement.profileId),
  ]);

  const dossier = buildProfileDossier(
    living.claims,
    preferences,
    clarifications,
  );
  // Le plan RANGÉ, jamais recalculé ici : trois appels de modèle par abonné et
  // par semaine coûteraient plus que le digest ne rapporte, et le plan est de
  // toute façon recalculé dès que la personne modifie son profil.
  const plan =
    (await lirePlanPrecalcule(admin, evenement.profileId, dossier)) ??
    planDeRepli(preferences.targetRoleFamilies, living.claims);

  const countries = preferences.allowedWorkRegions
    .map((r) => r.trim().toLowerCase())
    .map(
      (r) =>
        SEARCH_COUNTRIES.find(
          (c) => c.code === r || c.label.toLowerCase() === r,
        )?.code,
    )
    .filter((c) => c !== undefined)
    .slice(0, MAX_COUNTRIES_PER_SEARCH);

  const sources = configuredSources(countries);
  if (plan.plans.length === 0 || sources.length === 0) {
    return { envoye: false, raison: "rien_a_chercher" };
  }

  const resultat = await searchMarket(
    plan.plans,
    sources,
    preferences,
    profileSignalsFromClaims(living.claims),
    (source, p, error) => {
      log.warn("recherche digest en échec", {
        source,
        mode: p.mode,
        reason: error instanceof Error ? error.message : "unknown",
      });
    },
  );

  // Le tri IA n'est PAS appelé ici, et c'est délibéré : il coûte un appel par
  // abonné, et un digest de huit offres classées par des règles est déjà utile.
  // On dépense les crédits là où quelqu'un regarde.
  if (!meritEnvoi(resultat.hits)) {
    return { envoye: false, raison: "rien_a_montrer" };
  }

  const base = env.NEXT_PUBLIC_APP_URL;
  // DEUX URL, deux publics. Celle du pied de page s'adresse à un humain et
  // ouvre un écran qui explique ; celle de l'en-tête s'adresse au client de
  // messagerie, qui envoie un POST et n'attend qu'un 200. Les confondre donne
  // un bouton natif « se désabonner » qui répond 405 — donc le destinataire
  // clique sur celui d'à côté, qui est « spam ».
  const pageDesabonnement = `${base}/desabonnement?jeton=${evenement.unsubscribeToken}`;
  const unClicDesabonnement = `${base}/api/desabonnement?jeton=${evenement.unsubscribeToken}`;

  const { objet, html, texte } = construireDigest({
    hits: resultat.hits,
    stepUpTitles: plan.stepUpTitles,
    desabonnementUrl: pageDesabonnement,
    tableauDeBordUrl: `${base}/dashboard`,
  });

  await envoyerCourriel({
    a: evenement.email,
    objet,
    html,
    texte,
    desabonnementUrl: unClicDesabonnement,
  });

  // Écrit APRÈS l'envoi et seulement s'il a réussi : une date posée d'avance
  // sur un envoi qui échoue fait sauter la semaine en silence.
  await admin
    .from("digest_subscriptions")
    .update({
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", evenement.profileId);

  return { envoye: true };
}
