import { describe, expect, it } from "vitest";
import { PERSONAL_TABLES, deleteAccountSchema } from "@/domain/account";
import {
  buildAccountExport,
  exportFilename,
  lignesEmpreinte,
  NON_INCLUS,
} from "@/lib/account/export";
import { RETENTION, phraseDelai } from "@/lib/account/retention";

/**
 * L'export et le décompte : les deux endroits où une donnée manquante ne
 * ressemble pas à un bug, mais à une absence légitime. C'est ce qui les rend
 * dangereux, et ce qui justifie de les tester ligne à ligne.
 */

describe("buildAccountExport", () => {
  const compte = { email: "alice@test.local" };
  const date = new Date("2026-07-27T10:00:00Z");

  it("rend TOUJOURS les 20 sections, même vides", () => {
    // Une section absente et une section vide se ressemblent trop dans un JSON.
    // La première veut dire « on n'a pas su lire », la seconde « vous n'avez
    // rien ici » — les confondre laisse croire qu'on a tout reçu.
    const out = buildAccountExport({}, compte, date);
    expect(Object.keys(out.donnees).sort()).toEqual(
      [...PERSONAL_TABLES].sort(),
    );
    for (const table of PERSONAL_TABLES) {
      expect(out.donnees[table]).toEqual([]);
    }
  });

  it("signale par DIFFÉRENCE les sections qu'il n'a pas reçues", () => {
    // Calculé depuis la liste de référence, et non depuis les erreurs de
    // l'appelant : l'absence la plus probable est l'oubli d'ajouter une table
    // à la boucle de lecture, pas une exception attrapée.
    const out = buildAccountExport(
      { profile_claims: [{ id: "1" }], agent_runs: [] },
      compte,
      date,
    );
    expect(out.sectionsNonLues).not.toContain("profile_claims");
    expect(out.sectionsNonLues).not.toContain("agent_runs");
    expect(out.sectionsNonLues).toContain("evidence_items");
    expect(out.sectionsNonLues.length).toBe(PERSONAL_TABLES.length - 2);
  });

  it("une section lue mais vide n'est PAS signalée comme non lue", () => {
    const out = buildAccountExport({ agent_runs: [] }, compte, date);
    expect(out.donnees.agent_runs).toEqual([]);
    expect(out.sectionsNonLues).not.toContain("agent_runs");
  });

  it("embarque ce qu'il ne contient pas", () => {
    // Un fichier qui se présente comme « toutes vos données » sans dire ce
    // qu'il laisse dehors est trompeur par omission.
    const out = buildAccountExport({}, compte, date);
    expect(out.nonInclus).toEqual(NON_INCLUS);
    expect(out.nonInclus.length).toBeGreaterThan(0);
  });
});

describe("exportFilename", () => {
  it("porte la date du jour", () => {
    expect(exportFilename(new Date("2026-07-27T23:59:00Z"))).toBe(
      "missionpilot-donnees-2026-07-27.json",
    );
  });
});

describe("deleteAccountSchema", () => {
  it("n'accepte AUCUN identifiant — il n'y a pas de paramètre à changer", () => {
    // Le contrôle principal de la suppression : la cible vient de la session
    // vérifiée, jamais de la requête.
    expect(() =>
      deleteAccountSchema.parse({
        confirmation: true,
        userId: "22222222-2222-2222-2222-222222222222",
      }),
    ).toThrow();
  });

  it("exige une confirmation explicite", () => {
    expect(() => deleteAccountSchema.parse({})).toThrow();
    expect(() => deleteAccountSchema.parse({ confirmation: false })).toThrow();
    expect(deleteAccountSchema.parse({ confirmation: true })).toEqual({
      confirmation: true,
    });
  });
});

describe("phraseDelai", () => {
  it("dit qu'on ne sait pas quand on ne sait pas", () => {
    // `null` veut dire « personne n'est allé vérifier », jamais « zéro ».
    expect(phraseDelai(null)).toMatch(/ne pouvons pas encore/);
    expect(phraseDelai(null)).not.toMatch(/\d/);
  });

  it("annonce un délai seulement quand il est renseigné", () => {
    expect(phraseDelai(7)).toBe("Elles sont remplacées au bout de 7 jours.");
  });

  it("interdit d'afficher un chiffre absent de retention.ts", () => {
    // LE test qui compte. Il rend l'un ou l'autre obligatoire selon la
    // constante : impossible de publier un délai qui n'a pas été vu en console,
    // impossible d'y laisser `null` en affichant un chiffre.
    const texte = NON_INCLUS.join(" ");
    if (RETENTION.sauvegardesJours === null) {
      expect(texte).toMatch(/ne pouvons pas encore vous donner de délai/);
    } else {
      expect(texte).toMatch(
        new RegExp(`au bout de ${RETENTION.sauvegardesJours} jours`),
      );
    }
  });
});

describe("lignesEmpreinte", () => {
  it("n'affiche pas une ligne dont le compte vaut zéro", () => {
    // « 0 preuve » occupe de la place pour ne rien apprendre, et allonge une
    // liste qu'on lit au moment le moins confortable.
    expect(lignesEmpreinte({})).toEqual([]);
    expect(lignesEmpreinte({ candidate_profiles: 0, agent_runs: 0 })).toEqual(
      [],
    );
  });

  it("accorde les pluriels", () => {
    expect(
      lignesEmpreinte({ candidate_profiles: 1, profile_versions: 1 })[0],
    ).toBe("votre profil de travail et 1 version publiée");
    expect(
      lignesEmpreinte({ candidate_profiles: 1, profile_versions: 3 })[0],
    ).toBe("votre profil de travail et 3 versions publiées");
  });

  it("dit le profil seul quand aucune version n'est publiée", () => {
    expect(lignesEmpreinte({ candidate_profiles: 1 })).toEqual([
      "votre profil de travail",
    ]);
  });

  it("regroupe les quatre familles d'analyses IA en un seul total", () => {
    const lignes = lignesEmpreinte({
      ai_match_insights: 40,
      ai_match_breakdowns: 20,
      ai_application_drafts: 2,
      ai_interview_briefs: 1,
    });
    expect(lignes).toEqual(["63 analyses écrites pour vous par l'IA"]);
  });

  it("rattache les suivis aux offres plutôt que d'en faire une ligne", () => {
    expect(
      lignesEmpreinte({ opportunities: 128, opportunity_tracking: 12 }),
    ).toEqual(["128 offres importées, dont 12 suivies"]);
    expect(lignesEmpreinte({ opportunities: 5 })).toEqual([
      "5 offres importées",
    ]);
  });
});
