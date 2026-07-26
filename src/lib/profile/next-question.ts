import type { Readiness } from "./readiness";
import type { Understood } from "./understood";

/**
 * The ONE next question — and the rule that decides it is worth asking.
 *
 * THE TEST EVERY QUESTION MUST PASS: answering it must change what the person
 * sees on the very next screen. A question whose answer only fills a database
 * column is a toll booth, and people are right to abandon at toll booths. Each
 * question below either unlocks the automatic search outright or re-filters its
 * results — nothing else is asked, however tidy a fuller form would look.
 *
 * ORDER follows consequence, not convenience: identity first, because without
 * it there is no query at all; then the scope that decides whether results are
 * honestly filtered. That is the same weighting `assessReadiness` uses, so the
 * question asked is always the one that buys the most.
 *
 * "I DON'T KNOW" IS ALWAYS AVAILABLE and is recorded, not discarded. Asking
 * without an escape hatch does not produce knowledge; it produces invention.
 * On a product whose only stored asset is the profile, an invented answer
 * corrupts the one thing we keep — so a skip is a real, remembered outcome and
 * the question does not come back.
 *
 * Pure and deterministic: no model chooses what a person is asked about
 * themselves.
 */

export type QuestionTarget =
  | { kind: "claim"; claim: "role" | "seniority" | "years_experience" }
  | {
      kind: "preference";
      field:
        | "targetRoleFamilies"
        | "allowedWorkRegions"
        | "remotePolicy"
        | "preferredEngagementTypes";
    };

export type QuestionOption = {
  /** What is stored. */
  value: string;
  /** What is shown. */
  label: string;
};

export type ProfileQuestion = {
  /** Stable identity — the clarification row's `question_key`. */
  key: string;
  /** Asked in the second person, one thing at a time. */
  prompt: string;
  /**
   * What answering CHANGES, said concretely. Never "to complete your profile":
   * that describes our bookkeeping, not their benefit.
   */
  because: string;
  target: QuestionTarget;
  /** Pre-computed choices. Free text stays available alongside them. */
  options: QuestionOption[];
  /** Free-text placeholder, or null when the choices are exhaustive. */
  placeholder: string | null;
};

const SENIORITY_OPTIONS: QuestionOption[] = [
  { value: "Junior", label: "Junior" },
  { value: "Confirmé", label: "Confirmé" },
  { value: "Senior", label: "Senior" },
  { value: "Lead", label: "Lead / Principal" },
  { value: "Head", label: "Head / Directeur" },
];

const REMOTE_OPTIONS: QuestionOption[] = [
  { value: "remote_only", label: "Uniquement à distance" },
  { value: "remote_first", label: "À distance de préférence" },
  { value: "hybrid", label: "Hybride" },
  { value: "onsite_ok", label: "Sur site, ça me va" },
];

const ENGAGEMENT_OPTIONS: QuestionOption[] = [
  { value: "freelance", label: "Freelance / mission" },
  { value: "permanent", label: "CDI" },
  { value: "interim", label: "CDD / intérim" },
  { value: "part_time", label: "Temps partiel" },
];

const YEARS_OPTIONS: QuestionOption[] = [
  { value: "2", label: "Moins de 3 ans" },
  { value: "5", label: "3 à 7 ans" },
  { value: "10", label: "8 à 12 ans" },
  { value: "15", label: "Plus de 12 ans" },
];

export type QuestionContext = {
  readiness: Readiness;
  understood: Understood;
  preferences: {
    targetRoleFamilies: readonly string[];
    allowedWorkRegions: readonly string[];
    preferredEngagementTypes: readonly string[];
    remotePolicy: string | null;
  };
  /** Question keys already answered or skipped — never asked again. */
  settledKeys: readonly string[];
};

/**
 * The ordered catalogue. Each entry states the condition under which the
 * question is still owed; the first unsettled, still-owed question wins.
 */
function catalogue(ctx: QuestionContext): ProfileQuestion[] {
  const { understood, preferences } = ctx;
  const questions: ProfileQuestion[] = [];

  if (understood.lines.find((l) => l.kind === "role")?.value == null) {
    questions.push({
      key: "gap:role",
      prompt: "Quel métier exercez-vous aujourd'hui ?",
      because:
        "C'est avec ce mot que le marché nomme ses offres. Sans lui, je n'ai rien à chercher.",
      target: { kind: "claim", claim: "role" },
      options: preferences.targetRoleFamilies
        .filter((f) => f.trim() !== "")
        .slice(0, 4)
        .map((f) => ({ value: f, label: f })),
      placeholder: "Service Designer, Data Engineer, Chef de projet…",
    });
  }

  if (understood.lines.find((l) => l.kind === "seniority")?.value == null) {
    questions.push({
      key: "gap:seniority",
      prompt: "À quel niveau vous situez-vous ?",
      because:
        "C'est ce qui me permet de vous montrer la marche d'après, et pas le poste que vous avez déjà.",
      target: { kind: "claim", claim: "seniority" },
      options: SENIORITY_OPTIONS,
      placeholder: null,
    });
  }

  if (
    understood.lines.find((l) => l.kind === "years_experience")?.value == null
  ) {
    questions.push({
      key: "gap:years",
      prompt: "Combien d'années d'expérience avez-vous ?",
      because:
        "Beaucoup d'annonces filtrent là-dessus. Je peux écarter celles qui vous élimineraient d'office.",
      target: { kind: "claim", claim: "years_experience" },
      options: YEARS_OPTIONS,
      placeholder: null,
    });
  }

  if (preferences.allowedWorkRegions.length === 0) {
    questions.push({
      key: "gap:regions",
      prompt: "Où acceptez-vous de travailler ?",
      because:
        "Sans ça je cherche partout, et je vous montre des postes que vous ne prendriez jamais.",
      target: { kind: "preference", field: "allowedWorkRegions" },
      options: [
        { value: "France", label: "France" },
        { value: "Belgique", label: "Belgique" },
        { value: "Suisse", label: "Suisse" },
        { value: "Europe", label: "Partout en Europe" },
      ],
      placeholder: "France, Belgique, Canada…",
    });
  }

  if (preferences.remotePolicy === null) {
    questions.push({
      key: "gap:remote",
      prompt: "Le télétravail, c'est important pour vous ?",
      because: "Je peux écarter d'emblée ce qui ne correspond pas.",
      target: { kind: "preference", field: "remotePolicy" },
      options: REMOTE_OPTIONS,
      placeholder: null,
    });
  }

  if (preferences.preferredEngagementTypes.length === 0) {
    questions.push({
      key: "gap:engagement",
      prompt: "Vous cherchez quel type de contrat ?",
      because:
        "Une mission freelance et un CDI ne se cherchent pas au même endroit.",
      target: { kind: "preference", field: "preferredEngagementTypes" },
      options: ENGAGEMENT_OPTIONS,
      placeholder: null,
    });
  }

  if (preferences.targetRoleFamilies.length === 0) {
    questions.push({
      key: "gap:targets",
      prompt: "Y a-t-il un poste que vous visez en particulier ?",
      because: "Je le chercherai en plus de votre métier actuel.",
      target: { kind: "preference", field: "targetRoleFamilies" },
      options: [],
      placeholder: "Head of Design, Lead Data…",
    });
  }

  return questions;
}

/**
 * The next question still owed, or null when nothing useful is left to ask.
 *
 * Null is a real answer here, and it is the one the product should reach: it
 * means we know enough and have no business taking more of someone's time.
 */
export function nextQuestion(ctx: QuestionContext): ProfileQuestion | null {
  const settled = new Set(ctx.settledKeys);
  return catalogue(ctx).find((q) => !settled.has(q.key)) ?? null;
}

/** Every question the profile could still be asked, in order. For the profile
 *  page, which shows the road ahead rather than one step of it. */
export function pendingQuestions(ctx: QuestionContext): ProfileQuestion[] {
  const settled = new Set(ctx.settledKeys);
  return catalogue(ctx).filter((q) => !settled.has(q.key));
}
