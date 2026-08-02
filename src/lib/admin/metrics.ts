/**
 * AAARRR — mesuré sans rien surveiller de plus.
 *
 * LA DÉCISION QUI TIENT CE MODULE. Le réflexe, pour ces métriques, est de
 * poser un traceur : un événement à chaque clic, un identifiant qui suit les
 * gens de page en page. Ce produit ne peut pas se le permettre — sa politique
 * de confidentialité énumère chaque donnée enregistrée, et « nous savons sur
 * quoi vous avez cliqué » n'y figure pas. L'ajouter obligerait à réécrire la
 * politique, à recueillir un consentement, et à trahir l'argument même du
 * produit.
 *
 * Or presque tout se déduit de ce qui est DÉJÀ en base pour des raisons
 * fonctionnelles : une date de création de compte, une date de dernière
 * connexion, l'existence d'une affirmation confirmée. Aucune de ces lignes
 * n'a été ajoutée pour mesurer ; elles étaient là parce que le produit en a
 * besoin pour fonctionner.
 *
 * CE MODULE EST PUR. Il ne lit aucune base : il reçoit des lignes et rend des
 * nombres. C'est ce qui permet de tester la définition d'une cohorte sans
 * Supabase — et une définition de métrique, ça se teste, sinon on découvre au
 * bout de six mois qu'on comptait la mauvaise chose.
 *
 * DES AGRÉGATS, JAMAIS DES INDIVIDUS. Aucune fonction ici ne rend une adresse,
 * un identifiant ni un nom. Un tableau de pilotage qui laisse lire les CV
 * n'est pas un tableau de pilotage, c'est une fuite avec une interface.
 */

/** Ce qu'on lit d'un compte — rien de nominatif. */
export type CompteAnonyme = {
  creeLe: string;
  derniereConnexion: string | null;
  emailConfirme: boolean;
};

/** Ce qu'on lit d'un profil, réduit aux signaux de progression. */
export type ProfilAnonyme = {
  creeLe: string;
  affirmationsConfirmees: number;
  aDesMetiersCibles: boolean;
  aDesPreuves: boolean;
  abonneAuDigest: boolean;
};

export type Etape = {
  cle: string;
  libelle: string;
  /** Combien de personnes ont franchi cette étape. */
  compte: number;
  /** Part de l'étape PRÉCÉDENTE, pas du total : c'est la conversion d'un
   *  palier au suivant, la seule qui dise où ça coince. `null` sur la
   *  première marche, qui n'a pas de précédente. */
  conversion: number | null;
  /** Ce que l'étape signifie, en français, pour qui lit le tableau sans avoir
   *  écrit le code. */
  definition: string;
};

const JOUR = 24 * 60 * 60 * 1000;

/** Nombre de jours entiers entre deux instants ISO, ou `null` si l'un des deux
 *  est illisible — une date cassée ne doit pas compter comme « le même jour ». */
export function ecartEnJours(depuis: string, jusqua: string): number | null {
  const a = Date.parse(depuis);
  const b = Date.parse(jusqua);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / JOUR);
}

/**
 * ACQUISITION → ACTIVATION : l'entonnoir jusqu'au moment où le produit sert.
 *
 * « Activé » n'est pas « inscrit » : c'est le premier instant où l'écran
 * montre des offres. Compter les inscrits comme des utilisateurs est la
 * manière la plus courante de se mentir sur la traction.
 */
export function entonnoir(
  comptes: readonly CompteAnonyme[],
  profils: readonly ProfilAnonyme[],
): Etape[] {
  const inscrits = comptes.length;
  const confirmes = comptes.filter((c) => c.emailConfirme).length;
  const revenus = comptes.filter(
    (c) =>
      c.derniereConnexion !== null &&
      (ecartEnJours(c.creeLe, c.derniereConnexion) ?? 0) >= 1,
  ).length;
  const avecProfil = profils.filter((p) => p.affirmationsConfirmees > 0).length;
  // Le seuil du produit : des métiers cibles OU des affirmations confirmées
  // ouvrent la recherche automatique. C'est là que l'écran devient utile.
  const activés = profils.filter(
    (p) => p.aDesMetiersCibles || p.affirmationsConfirmees > 0,
  ).length;

  const etapes: Omit<Etape, "conversion">[] = [
    {
      cle: "inscrits",
      libelle: "Comptes créés",
      compte: inscrits,
      definition: "Une adresse est entrée dans le produit.",
    },
    {
      cle: "confirmes",
      libelle: "Adresse confirmée",
      compte: confirmes,
      definition: "Le lien de connexion a été cliqué au moins une fois.",
    },
    {
      cle: "profil",
      libelle: "Parcours renseigné",
      compte: avecProfil,
      definition:
        "Au moins une affirmation confirmée — CV lu ou question répondue.",
    },
    {
      cle: "actives",
      libelle: "Recherche ouverte",
      compte: activés,
      definition:
        "Le seuil où le tableau de bord montre des offres. C'est l'activation réelle, pas l'inscription.",
    },
    {
      cle: "revenus",
      libelle: "Revenus un autre jour",
      compte: revenus,
      definition:
        "Connectés au moins un jour APRÈS leur création. La première rétention, celle qui dit si le produit vaut un retour.",
    },
  ];

  return etapes.map((e, i) => ({
    ...e,
    conversion:
      i === 0 || etapes[i - 1].compte === 0
        ? null
        : Math.round((e.compte / etapes[i - 1].compte) * 100),
  }));
}

export type Retention = {
  actifs7j: number;
  actifs30j: number;
  jamaisRevenus: number;
};

/** RÉTENTION — qui est revenu, et sur quelle fenêtre. */
export function retention(
  comptes: readonly CompteAnonyme[],
  maintenant: number,
): Retention {
  const depuis = (c: CompteAnonyme): number | null => {
    if (c.derniereConnexion === null) return null;
    const t = Date.parse(c.derniereConnexion);
    return Number.isNaN(t) ? null : Math.floor((maintenant - t) / JOUR);
  };
  return {
    actifs7j: comptes.filter((c) => (depuis(c) ?? Infinity) <= 7).length,
    actifs30j: comptes.filter((c) => (depuis(c) ?? Infinity) <= 30).length,
    // Jamais revenu = une seule session, celle de l'inscription.
    jamaisRevenus: comptes.filter(
      (c) =>
        c.derniereConnexion === null ||
        (ecartEnJours(c.creeLe, c.derniereConnexion) ?? 0) < 1,
    ).length,
  };
}

/** Comptes créés par semaine ISO, du plus ancien au plus récent. */
export function acquisitionParSemaine(
  comptes: readonly CompteAnonyme[],
): { semaine: string; compte: number }[] {
  const paquets = new Map<string, number>();
  for (const c of comptes) {
    const d = new Date(c.creeLe);
    if (Number.isNaN(d.getTime())) continue;
    // Lundi de la semaine, en UTC : un découpage local ferait bouger les
    // frontières de cohorte selon le fuseau de qui regarde.
    const lundi = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    lundi.setUTCDate(lundi.getUTCDate() - ((lundi.getUTCDay() + 6) % 7));
    const cle = lundi.toISOString().slice(0, 10);
    paquets.set(cle, (paquets.get(cle) ?? 0) + 1);
  }
  return [...paquets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semaine, compte]) => ({ semaine, compte }));
}

/**
 * LA QUALITÉ — la seule mesure qui dise si le produit TIENT SA PROMESSE.
 *
 * Tout le reste de ce module mesure l'entonnoir : combien s'inscrivent,
 * combien reviennent. C'est utile et c'est insuffisant. Quelqu'un à qui le
 * moteur sert douze offres à côté de la plaque part, et l'entonnoir affiche
 * « jamais revenu » — un chiffre qui signale qu'un problème existe sans jamais
 * dire lequel. Le motif d'écartement, lui, le dit.
 *
 * ET IL EST DÉCLARÉ, PAS OBSERVÉ. C'est la personne qui a cliqué « pas le bon
 * métier ». Aucun traceur n'a regardé ce qu'elle faisait. C'est ce qui permet
 * d'avoir ce signal sans changer la nature du produit.
 */
export type Qualite = {
  /** Nombre total d'offres écartées, tous motifs et toutes personnes. */
  total: number;
  /** Le décompte par motif, du plus cité au moins cité. */
  parMotif: { motif: string; compte: number }[];
  /** Le réglage le plus souvent mis en cause, `null` tant que rien ne
   *  ressort — voir `reglageEnCause` côté produit, même prudence ici. */
  reglageEnCause: string | null;
};

/** Quel réglage du moteur chaque motif accuse. Dupliqué du produit à dessein :
 *  le pilotage ne doit pas dépendre d'un module `server-only`. */
const REGLAGE: Record<string, string> = {
  wrong_role: "le métier cherché",
  too_junior: "le niveau visé",
  too_senior: "le niveau visé",
  wrong_place: "la zone géographique",
  wrong_contract: "le type de contrat",
};

export function qualite(
  ecartements: readonly { motif: string; compte: number }[],
): Qualite {
  const parMotif = [...ecartements]
    .filter((e) => e.compte > 0)
    .sort((a, b) => b.compte - a.compte);
  const total = parMotif.reduce((n, e) => n + e.compte, 0);

  // Regroupé par RÉGLAGE, pas par libellé : « trop junior » et « trop senior »
  // sont deux erreurs opposées qui accusent la même chose — le niveau visé.
  // Les compter séparément laisserait le vrai coupable invisible.
  const parReglage = new Map<string, number>();
  for (const e of parMotif) {
    const r = REGLAGE[e.motif];
    if (!r) continue;
    parReglage.set(r, (parReglage.get(r) ?? 0) + e.compte);
  }
  const classe = [...parReglage].sort((a, b) => b[1] - a[1]);
  // Une égalité ne désigne rien, et désigner quand même serait inventer.
  const reglageEnCause =
    classe.length === 0 || (classe.length > 1 && classe[0][1] === classe[1][1])
      ? null
      : classe[0][0];

  return { total, parMotif, reglageEnCause };
}

export type Recommandation = {
  abonnesDigest: number;
  /** Aucune mécanique de parrainage n'existe. On le DIT, plutôt que d'afficher
   *  un zéro qui laisserait croire à un échec de traction. */
  parrainageExiste: false;
};

export function recommandation(
  profils: readonly ProfilAnonyme[],
): Recommandation {
  return {
    abonnesDigest: profils.filter((p) => p.abonneAuDigest).length,
    parrainageExiste: false,
  };
}
