import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Le décompte de tables annoncé dans la politique de confidentialité.
 *
 * POURQUOI CE TEST EXISTE. La politique écrit « ces règles sont actives sur les
 * N tables du schéma ». C'est une affirmation vérifiable dans un document dont
 * l'argument est justement d'être vérifiable — et elle était FAUSSE : elle
 * annonçait 16 alors que le schéma en comptait 17, `profile_search_plans`
 * ayant été ajoutée sans que personne ne repasse par le document.
 *
 * Une politique de confidentialité qui dérive du code est pire qu'une politique
 * vague : elle promet la précision et rend un chiffre faux. Ajouter une table
 * doit désormais casser ce test.
 */

const racine = process.cwd();

function tablesDuSchema(): string[] {
  const dossier = join(racine, "supabase/migrations");
  const noms = new Set<string>();
  for (const fichier of readdirSync(dossier)) {
    if (!fichier.endsWith(".sql")) continue;
    const sql = readFileSync(join(dossier, fichier), "utf8");
    // `if not exists` est toléré ici, et ce n'est pas de la complaisance :
    // le 2026-08-01, `offer_dismissals` a été créée sous cette forme et le
    // compte est passé sous le radar — la politique annonçait un chiffre de
    // plus que ce que ce test savait voir. Un test dont l'angle mort dépend
    // d'une variante de syntaxe ne protège rien.
    for (const m of sql.matchAll(
      /^create table (?:if not exists )?public\.(\w+)/gm,
    )) {
      noms.add(m[1]);
    }
  }
  return [...noms];
}

describe("la politique de confidentialité compte juste", () => {
  it("annonce le nombre RÉEL de tables du schéma", () => {
    const politique = readFileSync(
      join(racine, "content/legal/politique-de-confidentialite.md"),
      "utf8",
    );
    const annonce = politique.match(
      /règles sont actives sur les (\d+) tables du schéma/,
    );
    expect(annonce).not.toBeNull();
    expect(Number(annonce?.[1])).toBe(tablesDuSchema().length);
  });

  it("compte juste PARTOUT, pas seulement dans la phrase surveillée", () => {
    // Le 2026-09-01, la politique annonçait 23 tables en section 3 et 16 en
    // section 18. Le test ne regardait que la première phrase, donc la seconde
    // avait dérivé de sept tables sans rien casser — exactement le défaut que
    // ce fichier existe pour empêcher, dans une formulation que sa regex
    // n'atteignait pas. Un garde-fou qui ne couvre qu'une occurrence d'un fait
    // répété ne garde que la moitié du fait.
    const politique = readFileSync(
      join(racine, "content/legal/politique-de-confidentialite.md"),
      "utf8",
    );
    const reel = tablesDuSchema().length;
    const occurrences = [...politique.matchAll(/les (\d+) tables du schéma/g)];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    for (const occurrence of occurrences) {
      expect(Number(occurrence[1])).toBe(reel);
    }
  });

  it("nomme Resend dès lors que l'application sait envoyer un e-mail", () => {
    // La politique affirmait « aucun autre service d'e-mail n'intervient » à
    // côté de Supabase. Dès qu'un module d'envoi existe dans le code, cette
    // phrase devient fausse — et c'est un destinataire de données non déclaré,
    // ce que l'art. 13(1)(e) ne pardonne pas.
    const politique = readFileSync(
      join(racine, "content/legal/politique-de-confidentialite.md"),
      "utf8",
    );
    expect(politique).toContain("Resend");
    expect(politique).not.toContain(
      "aucun autre service d'e-mail n'intervient",
    );
  });
});
