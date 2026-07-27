import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Le lien magique, traversé pour de vrai : on demande le lien, on va le
 * chercher dans la boîte mail, on clique, et on doit être entré.
 *
 * Ce test existe parce que ce mécanisme a une panne MUETTE : si la route de
 * retour n'est pas publique, le proxy renvoie la personne vers la connexion
 * avant que la session soit créée. Elle clique sur son lien, retombe d'où elle
 * vient, redemande un lien, recommence — et rien à l'écran ne lui dit pourquoi.
 * Aucune vérification statique n'attrape ça ; seul un aller-retour complet le
 * prouve.
 *
 * En local, Supabase route les e-mails vers Inbucket (config.toml [local_smtp],
 * port 54324), qui expose une API de lecture. C'est ce qui rend le test
 * possible sans envoyer un vrai message.
 */

/**
 * Supabase route les e-mails locaux vers MAILPIT (config.toml [inbucket],
 * port 54324) — le nom de la section a survécu au changement d'outil, pas
 * l'API. Mailpit expose /api/v1/messages et /api/v1/message/{id}.
 */
const MAILPIT = "http://127.0.0.1:54324";

type Entete = { ID: string; To: { Address: string }[] };

async function lienDeConnexion(adresse: string): Promise<string | null> {
  for (let essai = 0; essai < 20; essai++) {
    const liste = await fetch(`${MAILPIT}/api/v1/messages`);
    if (liste.ok) {
      const { messages } = (await liste.json()) as { messages: Entete[] };
      const pourNous = messages.find((m) =>
        m.To.some((t) => t.Address.toLowerCase() === adresse.toLowerCase()),
      );
      if (pourNous) {
        const r = await fetch(`${MAILPIT}/api/v1/message/${pourNous.ID}`);
        const corps = (await r.json()) as { HTML?: string; Text?: string };
        const texte = `${corps.HTML ?? ""}\n${corps.Text ?? ""}`;
        // On suit le lien TEL QUEL plutôt que de le reconstruire : c'est la
        // vraie chaîne qu'on veut éprouver, pas une version idéalisée.
        const trouve = texte.match(
          /https?:\/\/[^\s"'<>]*(?:verify|confirm)[^\s"'<>]*/i,
        );
        if (trouve) return trouve[0].replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

test("demander un lien, le recevoir, cliquer, et être entré", async ({
  page,
}) => {
  const email = `magique-${randomUUID().slice(0, 8)}@test.local`;

  await page.goto("/login");
  await page.getByLabel("Votre e-mail").fill(email);
  await page
    .getByRole("button", { name: "Recevoir mon lien de connexion" })
    .click();

  // L'écran doit BASCULER : parler de la boîte mail, et ne plus proposer le
  // champ. Un formulaire encore actif invite à recliquer, et chaque clic
  // consomme une place sous le plafond d'envoi.
  await expect(page.getByText("Regardez votre boîte mail.")).toBeVisible();
  await expect(page.getByLabel("Votre e-mail")).toHaveCount(0);

  const lien = await lienDeConnexion(email);
  expect(
    lien,
    "aucun lien de connexion reçu dans la boîte de test",
  ).not.toBeNull();

  await page.goto(lien as string);
  // Le cœur du test : on arrive DANS le produit, pas sur la page de connexion.
  await expect(page).toHaveURL(/\/dashboard/);
});

test("un lien invalide ramène à la connexion en le disant", async ({
  page,
}) => {
  // Un jeton tronqué par un client de messagerie ne doit pas produire une page
  // blanche ni une erreur technique : la personne doit comprendre qu'il faut
  // en redemander un.
  await page.goto("/auth/confirm?token_hash=invalide&type=magiclink");
  await expect(page).toHaveURL(/\/login\?lien=/);
});
