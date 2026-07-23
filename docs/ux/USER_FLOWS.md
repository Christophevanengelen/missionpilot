# User Flows

Ten flows, each: trigger · typical turns · cards produced · error/doubt path ·
structured output. Wireframes are textual — structure and hierarchy, never
pixels. Terminology reuses `CONVERSATION_FRAMEWORK.md` states and the domain
model. Priority: **P1** (1-3, 5-6) specified in depth; **P2** (7-9) and **P3**
(4, 10) specified fully but more briefly.

Legend for wireframes: `[ ]` region · `( )` action · `‹badge›` a badge —
card lifecycle **state** (`proposed`/`confirmed`/`needs_review`/`rejected`),
a **verdict** (e.g. `Strong match`), or a **message type** (e.g. `error`);
the underlying state token is language-neutral even when the badge is shown
localized (`‹confirmé›` renders the `confirmed` state) · `»` assistant turn ·
`›` user message.

---

## Flow 1 — Conversational onboarding (P1)

**Trigger:** first sign-in, empty profile.
**Goal:** establish who the user is and what they want, one question at a time,
producing the first `proposed` profile cards.

Turns: welcome + single opening question ("What kind of work are you looking
for?") → user answers freely → assistant reflects understanding as a
`proposed` card + one follow-up question. No forms.

```text
[ Header  MissionPilot                         (☾ theme) (Se déconnecter) ]
[ Thread ───────────────────────────────────────────────  [ Context ▸ ] ]
  » Bonjour. Je vais vous aider à trouver des missions qui
    vous correspondent vraiment. Pour commencer :
    Quel type de mission recherchez-vous ?
  ›  Du design produit senior, en full remote, ~700€/j.
  » Voici ce que j'ai compris :
    ┌ Ce que j'ai compris ································· ‹proposed› ┐
    │ Rôle        Product Designer (senior)                        │
    │ Remote      Full remote (obligatoire)                        │
    │ TJM cible   700 € / jour                                     │
    │ ( Confirmer ) ( Corriger ) ( Ignorer ) ( Approfondir )       │
    └──────────────────────────────────────────────────────────────┘
    Est-ce correct ? Sinon, dites-moi ce qui change.
  [ suggestion chips:  (Full remote confirmé) (Ajuster le TJM) ]
[ Composer  ▸ Écrivez votre réponse…                          ( Envoyer ) ]
```

Cards: one "understanding" card (profile stub). Error/doubt: unclear input →
a single `needs_review` field, not a rejection. Structured output: a
`proposed` candidate profile draft feeding Flow 2.

---

## Flow 2 — Professional profile creation (P1)

**Trigger:** onboarding confirmed, or "complete my profile".
**Goal:** turn the proposed stub into a `confirmed`, versioned profile,
surfacing gaps and conflicts without long forms.

Turns walk the profile dimensions **one at a time** (target roles → rate →
engagement type → locations → time-zone → hard exclusions), each as a
`proposed` card the user confirms/corrects. Already-known facts (from Flow 1)
are pre-filled and **never re-asked** (memory contract).

```text
  » Vous avez confirmé : Product Designer, full remote, 700 €/j.
    Il me manque votre tolérance de fuseau horaire. Une préférence ?
    ┌ Préférence — Fuseau horaire ····················· ‹proposed› ┐
    │ Chevauchement souhaité   ▢ ≥4h  ▣ ≥2h  ▢ indifférent        │
    │ ( Confirmer ) ( Corriger )                                   │
    └──────────────────────────────────────────────────────────────┘
  [ Context ▾  Ce que MissionPilot a compris ]
    · Rôle ‹confirmé› · Remote ‹confirmé› · TJM ‹confirmé›
    · Fuseau ‹proposed› · Exclusions —
    · Complétude du profil ▓▓▓▓▓░░░  62 %   (non-intrusive)
```

Cards: one per dimension. Completeness/conflict shown in the context panel
(desktop) or top sheet (mobile). Structured output: on "Publish", an
immutable `profile_version` (`confirmed` facts only). Hard constraints are
visibly distinguished from preferences (UX_SPEC / PRD Journey A).

---

## Flow 3 — Add & validate evidence (P1)

**Trigger:** "add a project/result/skill", or the assistant asking for proof
behind a claim.
**Goal:** capture atomic, reusable evidence items with provenance and a
verification status — the material Phase 1 depends on.

Turns: user pastes/describes a project → assistant extracts an **evidence
card** (achievement/metric/skill/portfolio) with per-field confidence and
`sourceType`/provenance → user confirms or corrects. Imported or
model-extracted facts stay **unverified until the user confirms** (Phase 1
safety rule; verificationStatus `imported` → `user_confirmed`).

```text
  » J'ai lu votre description. Voici la preuve que j'en tire :
    ┌ Preuve — Réalisation ···························· ‹needs_review› ┐
    │ Titre     Refonte du checkout — e-commerce                     │
    │ Métrique  +18 % de conversion  ⚠ à confirmer                   │
    │ Période   2023 – 2024                                          │
    │ Source    texte fourni par vous · non vérifié                 │
    │ Compétences  UX, Design System, A/B testing                   │
    │ ( Confirmer ) ( Corriger la métrique ) ( Ignorer ) ( Détails ) │
    └────────────────────────────────────────────────────────────────┘
    Le chiffre de +18 % vient de votre texte — pouvez-vous le confirmer ?
```

Cards: one evidence card per item; a metric MissionPilot can't verify is
`needs_review`, never silently trusted. Structured output: `confirmed`
`evidence_items` tied to the profile version, each citable by later scoring.

---

## Flow 4 — Clarify mission preferences (P3)

**Trigger:** profile published, or "refine what I'm looking for".
**Goal:** capture soft preferences and their weights transparently.

Turns: one preference dimension at a time (strategic scope, domains,
company size, contract nuances), each a `proposed` card. Weight changes are
shown, never applied silently (`no silent learning`).
**Error/doubt path:** a preference that conflicts with a hard constraint
(e.g. "prefer on-site" vs "full remote required") surfaces as `needs_review`
naming the conflict, not a silent override; the user resolves which wins.
Structured output: `preferences` on the profile version; the user can reset
learned preferences.

---

## Flow 5 — Recommended opportunity (P1)

**Trigger:** a qualified opportunity is ready (or the demo shows one).
**Goal:** present a single recommendation with verdict, remote/compensation
status, top strength and main risk — decision-first, not a data dump.

```text
  » Une mission correspond fortement à votre profil.
    ┌ Opportunité ···································· ‹proposed› ┐
    │ Lead Product Designer · Acme (Series B)                    │
    │ ‹Strong match›   Score 86 / 100   Confiance 72 %           │
    │ Remote  ✅ Full remote (EMEA)   TJM  ● connu 750 €/j       │
    │ Atout   Design systems à grande échelle → vos preuves     │
    │ Risque  Domaine fintech peu présent dans votre historique │
    │ ( Voir le score ) ( Comparer ) ( Enregistrer ) ( Ignorer ) │
    └────────────────────────────────────────────────────────────┘
```

Score and confidence are **separate values**. Remote and compensation status
are explicit (known vs unknown, never guessed). Actions: see score (Flow 6),
compare (switches to structured comparator), save, ignore. Structured output:
a `match_analysis` referenced by the card; "see all" switches to the
opportunity inbox table.

---

## Flow 6 — Explain the match score (P1)

**Trigger:** "See the score" on an opportunity.
**Goal:** make the score legible component by component, each linked to
evidence — never one opaque number.

```text
  ┌ Pourquoi ce score ······························· ‹proposed› ┐
  │ Score pondéré              86 / 100     Confiance  72 %      │
  │ Contraintes dures          ✅ pass                          │
  │ ─────────────────────────────────────────────────────────  │
  │ Couverture de preuves  ▓▓▓▓▓▓▓▓░  82   → 3 preuves liées    │
  │ Rôle / séniorité       ▓▓▓▓▓▓▓▓▓  90   → « Lead » ↔ 20 ans  │
  │ Portée stratégique     ▓▓▓▓▓▓▓░░  74   → design systems     │
  │ Faisabilité remote     ▓▓▓▓▓▓▓▓▓  95   → full remote EMEA   │
  │ Fit commercial         ▓▓▓▓▓▓▓░░  70   → 750€ ≥ plancher    │
  │ Pertinence domaine     ▓▓▓░░░░░░  35   ⚠ fintech faible     │
  │ ( Voir les preuves )  ( Corriger une hypothèse )            │
  └──────────────────────────────────────────────────────────────┘
```

Every component row links to the evidence behind it (`evidence[]`);
`⚠` marks a low component with its reason. Missing compensation lowers
**confidence**, not fit (PRD §6). Structured output: none new — this is a
read/inspect surface with correction affordances feeding Flow 7.

---

## Flow 7 — Correct a mis-understood fact (P2)

**Trigger:** "Correct" on any card, or the user spotting a wrong value.
**Goal:** frictionless correction; the system, not the user, owns the mistake.

Turns: tapping Correct opens **inline edit of just the affected field(s)**;
everything else is preserved. On save, a `confirmed` card re-opens as a new
`proposed` version; dependent cards (e.g. a score using the old value) are
flagged for re-review rather than silently recomputed. Voice: "Je corrige"
— never blame. Structured output: an appended version (history immutable);
downstream `match_analysis` marked stale, not overwritten.

---

## Flow 8 — Approval before an external action (P2)

**Trigger:** any outward effect requested (export, send, contact). None ship
before Phase 4, but the pattern is foundational.
**Goal:** explicit, reversible human approval with the exact payload previewed.

```text
  ┌ Validation requise ·····························  ⚠ action externe ┐
  │ MissionPilot ne fait rien sans votre accord.                     │
  │ Action     Exporter le CV adapté (PDF)                           │
  │ Contenu    3 sections · 6 puces · 0 affirmation non vérifiée     │
  │ Destination  Téléchargement local (aucun envoi tiers)            │
  │ ( Annuler )                       ( Approuver et exporter )      │
  └──────────────────────────────────────────────────────────────────┘
```

Decline (`Annuler`) is at least as prominent as approve; closing the card
declines; no timeout approves. If any generated claim is unverified, the
approve control is **disabled** with the reason named (UX_SPEC application
workspace). Structured output: an audit event only on explicit approval.

---

## Flow 9 — Error, doubt, low confidence (P2)

**Trigger:** extraction failure, unreachable service, or low-confidence result.
**Goal:** keep the user oriented and in control; never lose their input.

- **Recoverable error:** calm message + ( Réessayer ); the composed input is
  retained. Distinct from a hard failure (unmistakable, per UX_SPEC).
- **Low confidence / doubt:** `needs_review` card naming exactly what's
  missing ("Je n'ai pas trouvé le TJM — c'est bien 700 € ?").
- **Offline:** a non-blocking banner; the thread stays readable; actions that
  need the network are disabled with a clear reason and a retry.

```text
  ┌ ····························································· ‹error› ┐
  │ Je n'ai pas pu analyser ce texte à l'instant.                     │
  │ Votre message est conservé.                     ( Réessayer )     │
  └────────────────────────────────────────────────────────────────────┘
```

Structured output: none; the failed step is recorded (runs & quality), not
hidden.

---

## Flow 10 — Resume an interrupted conversation (P3)

**Trigger:** returning after leaving mid-conversation.
**Goal:** natural continuation with no repetition of known facts.

Turns: on return, the thread restores with a top **context summary** ("Voici
où nous en étions"), the last actionable card focused, and the next single
question — never re-asking anything `confirmed`. Progress is non-intrusive.
**Error/doubt path:** if the prior state cannot be fully restored, the
summary says so plainly ("Je n'ai pas pu retrouver la dernière étape") and
offers to resume from the last `confirmed` facts rather than starting over —
no confirmed fact is silently lost, and the user is never blamed.
Structured output: none; state is the persisted cards/profile (persistence
itself is Phase 1+; the UX Preview simulates it with mock data).
