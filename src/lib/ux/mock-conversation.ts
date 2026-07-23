/**
 * Static mock data for the UX Preview route only. No backend, no persistence,
 * no external call. Clearly synthetic — never real personal data. Types live
 * in ./conversation-types so the components stay decoupled from these
 * fixtures.
 */
import type { KnownFact, Turn } from "@/lib/ux/conversation-types";

export const mockThread: Turn[] = [
  {
    role: "assistant",
    id: "t1",
    text: "Bonjour. Je vais vous aider à trouver des missions qui vous correspondent vraiment.",
    question: "Quel type de mission recherchez-vous ?",
    lead: true,
  },
  {
    role: "user",
    id: "t2",
    text: "Du design produit senior, en full remote, autour de 700 € par jour.",
  },
  {
    role: "assistant",
    id: "t3",
    text: "Voici ce que j'ai compris — dites-moi si c'est juste.",
    card: {
      kind: "understanding",
      id: "c-understanding",
      title: "Ce que j'ai compris",
      state: "proposed",
      fields: [
        { label: "Rôle", value: "Product Designer (senior)" },
        { label: "Remote", value: "Full remote (obligatoire)" },
        { label: "TJM cible", value: "700 € / jour" },
      ],
    },
    chips: ["Full remote confirmé", "Ajuster le TJM"],
  },
  {
    role: "assistant",
    id: "t4",
    text: "J'ai lu votre description de projet. Voici la preuve que j'en tire — le chiffre reste à confirmer.",
    card: {
      kind: "evidence",
      id: "c-evidence",
      title: "Preuve — Réalisation",
      state: "needs_review",
      fields: [
        {
          label: "Titre",
          value: "Refonte du checkout — e-commerce",
          wide: true,
        },
        {
          label: "Métrique",
          value: "+18 % de conversion",
          warn: "à confirmer",
        },
        { label: "Période", value: "2023 – 2024" },
        { label: "Source", value: "texte fourni · non vérifié", wide: true },
        {
          label: "Compétences",
          chips: ["UX", "Design System", "A/B testing"],
          wide: true,
        },
      ],
    },
  },
  {
    role: "assistant",
    id: "t4b",
    text: "Vous avez écarté cette preuve — elle reste de côté, restaurable à tout moment.",
    card: {
      kind: "evidence",
      id: "c-evidence-rejected",
      title: "Preuve — Certification",
      state: "rejected",
      restorable: true,
      fields: [
        { label: "Titre", value: "Certification Scrum (2018)" },
        { label: "Raison", value: "Peu pertinent pour ce rôle" },
      ],
    },
  },
  {
    role: "assistant",
    id: "t5",
    text: "Une mission correspond fortement à votre profil.",
    card: {
      kind: "opportunity",
      id: "c-opportunity",
      title: "Opportunité recommandée",
      state: "proposed",
      role: "Lead Product Designer",
      company: "Acme (Series B)",
      verdict: "strong_match",
      score: 86,
      confidence: 72,
      remote: "Full remote (EMEA)",
      rate: "750 € / jour",
      strength: "Design systems à grande échelle → vos preuves",
      risk: "Domaine fintech peu présent dans votre historique",
    },
  },
  {
    role: "assistant",
    id: "t6",
    text: "Pourquoi ce score, composant par composant :",
    card: {
      kind: "score",
      id: "c-score",
      title: "Pourquoi ce score",
      state: "proposed",
      weighted: 86,
      confidence: 72,
      hardConstraint: "pass",
      components: [
        {
          label: "Couverture de preuves",
          value: 82,
          evidence: "3 preuves liées",
        },
        { label: "Rôle / séniorité", value: 90, evidence: "« Lead » ↔ 20 ans" },
        { label: "Portée stratégique", value: 74, evidence: "design systems" },
        {
          label: "Faisabilité remote",
          value: 95,
          evidence: "full remote EMEA",
        },
        { label: "Fit commercial", value: 70, evidence: "750 € ≥ plancher" },
        {
          label: "Pertinence domaine",
          value: 35,
          evidence: "fintech faible",
          low: true,
        },
      ],
    },
  },
  {
    role: "assistant",
    id: "t7",
    text: "Avant toute action externe, je vous demande votre accord.",
    card: {
      kind: "approval",
      id: "c-approval",
      title: "Validation requise",
      action: "Exporter le CV adapté (PDF)",
      detail: "3 sections · 6 puces · 0 affirmation non vérifiée",
      destination: "Téléchargement local (aucun envoi tiers)",
      blocked: false,
    },
  },
];

/** Running known-facts set for the context summary (mirrors thread cards). */
export const mockKnownFacts: KnownFact[] = [
  { label: "Rôle", value: "Product Designer (senior)", state: "confirmed" },
  { label: "Remote", value: "Full remote", state: "confirmed" },
  { label: "TJM", value: "700 € / jour", state: "confirmed" },
  {
    label: "Fuseau horaire",
    value: "≥ 2 h de chevauchement",
    state: "proposed",
  },
  {
    label: "Preuve — checkout",
    value: "+18 % conversion",
    state: "needs_review",
  },
  { label: "Certification Scrum", value: "écartée", state: "rejected" },
];

export const mockProgress = 62;

/** Simulated states of the thread region, for the state switcher in preview. */
export { THREAD_STATES as previewStates } from "@/lib/ux/conversation-types";
export type { ThreadState as PreviewState } from "@/lib/ux/conversation-types";
