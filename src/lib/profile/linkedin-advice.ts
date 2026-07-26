import type { Understood } from "./understood";

/**
 * Help with the LinkedIn profile — grounded in THEIR profile, never a listicle.
 *
 * The test every item passes: it names something we actually observed about
 * this person, and it says what to do about it. "Optimisez votre titre" is
 * advice anyone could give without reading anything; "votre titre devrait dire
 * Service Designer Senior — c'est le mot avec lequel le marché nomme ses
 * offres" is advice only someone who read their record can give.
 *
 * So an item exists ONLY when the profile supplies its grounds. A profile we
 * know little about produces little advice, and that is the honest outcome —
 * padding the list with generalities would be indistinguishable from having
 * read nothing, which is exactly the impression to avoid.
 *
 * Pure and deterministic: no model, no external call, nothing sent anywhere.
 * We never touch LinkedIn — the person applies these themselves.
 */

export type AdviceItem = {
  key: string;
  /** The action, in the imperative. */
  action: string;
  /** Why — anchored in what we read about THEM. */
  grounds: string;
  /** Text they can copy as-is, when there is one. */
  draft: string | null;
  /**
   * Where the advice leads, when the product can carry it further.
   *
   * Advice that ends at "now go do it elsewhere" wastes the moment someone is
   * actually willing to act. Telling somebody to ask for a recommendation and
   * giving them no way to record the one that comes back is a hole we dug
   * ourselves.
   */
  follow: { href: string; label: string } | null;
};

export type AdviceInput = {
  understood: Understood;
  /** Recommendations already recorded as testimonial evidence. */
  testimonialCount: number;
  /** Achievements confirmed on the profile. */
  achievementCount: number;
};

export function linkedinAdvice(input: AdviceInput): AdviceItem[] {
  const { understood, testimonialCount, achievementCount } = input;
  const role = understood.lines.find((l) => l.kind === "role")?.value;
  const seniority = understood.lines.find((l) => l.kind === "seniority")?.value;
  const items: AdviceItem[] = [];

  // 1. The headline. Only offered once we know the market word for them,
  //    because the whole point of the advice is the specific word.
  if (role !== null && role !== undefined) {
    const headline =
      seniority !== null && seniority !== undefined
        ? `${role} — ${seniority}`
        : role;
    items.push({
      key: "headline",
      action: "Mettez votre métier dans votre titre, pas votre employeur",
      grounds: `Le marché nomme ses offres « ${role} ». Un recruteur qui cherche ce mot ne vous trouve pas si votre titre dit « chez Acme ».`,
      draft: headline,
      follow: null,
    });
  }

  // 2. Skills. LinkedIn's own search leans on the declared skill list, and we
  //    already know which ones their CV supports.
  if (understood.skills.length >= 3) {
    items.push({
      key: "skills",
      action: "Déclarez ces compétences sur votre profil",
      grounds: `Nous en avons lu ${understood.skills.length} dans votre CV. Les recherches de recruteurs filtrent sur cette liste, et ce qui n'y figure pas n'existe pas pour elles.`,
      draft: understood.skills.slice(0, 10).join(" · "),
      follow: null,
    });
  }

  // 3. Recommendations. This is the owner's explicit ask: when someone has
  //    none, help them ASK — a blank "get recommendations" nudge is the part
  //    everybody already knows and nobody acts on. The hard part is the
  //    message, so we write it.
  if (testimonialCount === 0) {
    items.push({
      key: "ask-recommendation",
      action:
        "Demandez une recommandation à quelqu'un qui a travaillé avec vous",
      grounds:
        "Vous n'en avez aucune enregistrée. C'est la seule chose sur un profil que vous n'écrivez pas vous-même — et donc la seule qu'un recruteur lit sans filtre.",
      draft: [
        "Bonjour X,",
        "",
        role !== null && role !== undefined
          ? `J'actualise mon profil et je mets en avant mon travail de ${role}.`
          : "J'actualise mon profil professionnel en ce moment.",
        "Tu as vu de près ce que j'ai fait sur [projet]. Accepterais-tu d'écrire quelques lignes ?",
        "Trois ou quatre phrases sur ce que j'ai concrètement pris en charge suffisent largement — surtout le périmètre et le résultat.",
        "",
        "Merci beaucoup,",
      ].join("\n"),
      // The other half of the advice: once it arrives, there is somewhere to
      // put it, and it becomes proof on the profile rather than a screenshot
      // in someone's downloads folder.
      follow: {
        href: "/profile/recommendations",
        label: "Enregistrer une recommandation reçue",
      },
    });
  }

  // 4. Results. Only raised when the record is thin on them — telling someone
  //    who already quantified everything to quantify things reads as not
  //    having looked.
  if (achievementCount < 2) {
    items.push({
      key: "achievements",
      action: "Ajoutez un résultat chiffré sous chaque poste",
      grounds:
        achievementCount === 0
          ? "Votre parcours ne porte encore aucun résultat concret. C'est ce qui distingue un intitulé d'une preuve."
          : "Vous n'en avez qu'un. Un par poste change la lecture d'un profil.",
      draft: null,
      follow: null,
    });
  }

  return items;
}
