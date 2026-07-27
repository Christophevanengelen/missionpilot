import "server-only";

import { createClient } from "@/lib/db/server";
import { createLogger } from "@/lib/observability/logger";
import { aiAnalyzeCvProfile } from "./cv-ai";
import { detectSkills } from "./cv-extract";
import * as profile from "./logic";

/**
 * Ce qu'on fait du parcours une fois LinkedIn interrogé.
 *
 * LA DÉCISION QUI COMPTE ICI : **rien n'est confirmé**. Les affirmations sont
 * déposées telles quelles, et c'est la personne qui les valide ensuite sur
 * l'écran de restitution.
 *
 * La tentation était forte de tout confirmer d'office — les données viennent
 * de LinkedIn, elles ont l'air fiables, et ça ferait gagner un écran. Mais le
 * produit tient sur une boucle précise : on restitue ce qu'on a compris AVANT
 * de demander quoi que ce soit, et la personne tranche. Un profil qui se
 * remplirait tout seul dans le dos de son propriétaire — avec un intitulé de
 * poste obsolète ou une séniorité mal lue — casserait exactement la confiance
 * que le reste du produit passe son temps à construire. Et personne ne corrige
 * ce qu'il n'a pas vu passer.
 *
 * Le texte de parcours n'est PAS conservé : il traverse l'analyse et disparaît
 * avec l'appel, comme le fichier CV et comme le jeton.
 */

const log = createLogger({ module: "linkedin-import" });

/** Plafond volontairement bas : au-delà, l'écran de validation devient une
 *  corvée qu'on expédie, et une validation expédiée ne vaut rien. */
const MAX_COMPETENCES = 30;

export async function importerParcours(entree: {
  text: string;
  skills: string[];
}): Promise<{ deposees: number }> {
  const texte = entree.text.trim();
  if (texte === "") return { deposees: 0 };

  const client = await createClient();
  const sien = await profile.getOwnProfile(client);

  const comprehension = await aiAnalyzeCvProfile(texte);
  let deposees = 0;

  const deposer = async (
    genre: "role" | "seniority" | "years_experience" | "summary" | "skill",
    valeur: unknown,
  ) => {
    // `origin: "assistant"` et AUCUN passage à l'état confirmé : l'affirmation
    // reste proposée jusqu'à ce qu'une personne la regarde.
    await profile.submitClaim(client, sien.id, genre, valeur, {
      origin: "assistant",
    });
    deposees += 1;
  };

  if (comprehension) {
    if (comprehension.roleTitle) {
      await deposer("role", { title: comprehension.roleTitle });
    }
    if (comprehension.seniorityLevel) {
      await deposer("seniority", { level: comprehension.seniorityLevel });
    }
    if (typeof comprehension.yearsExperience === "number") {
      await deposer("years_experience", {
        years: comprehension.yearsExperience,
      });
    }
    if (comprehension.summary) {
      await deposer("summary", { text: comprehension.summary });
    }
  }

  // Les compétences déclarées sur LinkedIn ET celles que le détecteur
  // déterministe reconnaît dans le récit. Sans clé d'IA, ce chemin reste seul —
  // et l'import fonctionne quand même, en mode dégradé plutôt qu'en panne.
  const vues = new Set<string>();
  const competences: string[] = [];
  for (const nom of [
    ...(comprehension?.coreSkills ?? []),
    ...entree.skills,
    ...detectSkills(texte),
  ]) {
    const cle = nom.trim().toLowerCase();
    if (!cle || vues.has(cle)) continue;
    vues.add(cle);
    competences.push(nom.trim());
    if (competences.length >= MAX_COMPETENCES) break;
  }
  for (const nom of competences) await deposer("skill", { name: nom });

  log.info("parcours linkedin déposé", {
    deposees,
    iaUtilisee: comprehension !== null,
  });
  return { deposees };
}
