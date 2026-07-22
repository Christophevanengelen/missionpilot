# Conversation Framework

How MissionPilot turns an ongoing conversation into verifiable structured
data, with the user in control at every step. Implements the paradigm in
`UX_PRINCIPLES.md`.

## Turn model

A **turn** is one assistant contribution to the thread. A turn contains at
most **one important question** (Principle 1) and may render **cards** — the
structured proposals the user acts on.

```text
user message ──▶ [deterministic parse + AI extraction] ──▶ assistant turn:
    · a short natural-language reply
    · zero or more proposal cards  (state: proposed)
    · at most one important question
    · suggestion chips (optional shortcuts)
```

Nothing derived from a turn is treated as fact until the user confirms it.
Extraction always yields `proposed` cards, never silent writes.

## Card lifecycle (the state machine)

The card lifecycle is a **UX-layer** state machine. `needs_review` is shared
**verbatim** with the AI-output envelope (`schemas/agent-output.schema.json`
`status` enum); `proposed`, `confirmed` and `rejected` are UX states that
sit alongside — not identical to — the domain vocabulary (`candidate_profiles`
uses `draft/published/archived`, `evidence_items` uses
`imported/user_confirmed/externally_verified`). They map onto those domain
states when a card is persisted (e.g. a `confirmed` evidence card →
`verificationStatus = user_confirmed`), but the card states themselves are
the conversation's own contract and are never invented per-feature:

| State          | Meaning                                                        | How it's reached                                                       | Available actions                                      |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `proposed`     | MissionPilot's understanding, awaiting the user                | after extraction                                                       | confirm · correct · ignore · go deeper                 |
| `confirmed`    | user-validated fact; part of memory                            | user confirms a `proposed` card                                        | correct (re-opens) · go deeper                         |
| `needs_review` | low confidence / conflict / ambiguity — MissionPilot is unsure | AI confidence below threshold, contradictory evidence, or missing data | confirm · correct · go deeper (never silently dropped) |
| `rejected`     | user declined or ignored; excluded from reasoning, not deleted | user ignores/rejects                                                   | restore                                                |

Rules: a `proposed`/`needs_review` card never influences scoring or drafting;
only `confirmed` cards do. Transitions are user-driven except the initial
`proposed`/`needs_review` classification. History is append-only — correcting
a `confirmed` card records a new version, it does not erase the prior one
(mirrors `DOMAIN_MODEL.md` immutability rules). `needs_review` is a
first-class outcome, visually distinct, never collapsed into an error.

## The four core actions

Present on every proposal, one tap each, keyboard-first:

- **Confirm** — accept as-is → `confirmed`.
- **Correct** — inline-edit the specific field(s); the rest is preserved (no
  re-typing). Re-opens a `confirmed` card to a new proposed version.
- **Ignore** — set aside → `rejected` (restorable). Never a dead end.
- **Go deeper** — ask MissionPilot to explain, cite evidence, or expand;
  opens detail without leaving the thread.

## Memory contract (never ask twice — Principle 6)

- The session holds a **known-facts set** = all `confirmed` cards + the
  active profile version's data.
- Before composing a question, the assistant checks the known-facts set; a
  question whose answer is already known is a defect.
- Known facts are shown in the **context summary** ("what MissionPilot
  understood") so the user sees the running state without re-stating it.
- When a fact changes, the dependent cards are flagged for re-review rather
  than silently recomputed (`no silent learning`, ENGINEERING_PRINCIPLES §14).

## Evidence & explanation (Principle 7)

Every claim, recommendation and score component carries evidence references
(profile evidence ids and/or source passages), reusing the
`agent-output.schema.json` envelope (`evidence[]`, `confidence`, `warnings`).
Scores are shown **component by component** (PRD §6), each component linked
to the evidence that supports it. Confidence is displayed separately from
fit (a low-confidence strong match is not a weak match).

## Human approval for external actions (Principle 8)

Any outward effect (send, export to a third party, contact) is gated by an
**approval card** that previews the exact payload, requires an explicit
confirm, and makes the decline path at least as prominent as approve. No
timeout auto-approves; closing the card is a decline. (ADR-0002.)

## Switching to structured views (Principle 10)

Switch **from conversation to a table/structured view** when: many peer items
must be scanned or compared (opportunity inbox, evidence library), the user
asks to "see all", or a comparison spans more than ~3 items. Switch **back to
conversation** for a single decision, a nuance, or a correction. The switch
is offered as an affordance (a "view all" action / a returning "discuss this"
action), never forced; state is shared both ways (a card selected in a table
is the same entity as in the thread).

## Error, doubt, low confidence (flow 9)

- **Recoverable error** (extraction failed, service unreachable): a calm
  message in the product voice + a retry action; the user's input is never
  lost.
- **Doubt / low confidence**: surfaces as `needs_review`, with what's missing
  named explicitly ("I couldn't tell the day rate from this — is it €X?").
- **Hard failure**: unmistakable (UX_SPEC), distinguished from "not enough
  information".

## Interrupted-conversation resume (flow 10)

On return, the thread is restored with the context summary at the top ("Here's
where we were"), the last actionable card focused, and no repetition of
already-`confirmed` facts. Progress indication is non-intrusive.

---

# Writing rules / Règles de rédaction

Product voice: a senior advisor — precise, direct, reassuring; never
obsequious, never hype, never emoji-as-personality. French by default,
English supported (see i18n note below).

**Principles (EN):** one idea per message · say what you understood before
asking · name uncertainty plainly · never blame the user for a
mis-understanding ("Let me fix that" not "You entered this wrong") · prefer
concrete words to jargon · questions are answerable in one short reply ·
never promise an external action without the approval step.

**Principes (FR) :** une idée par message · dire ce qui a été compris avant de
demander · nommer l'incertitude simplement · ne jamais reprocher à
l'utilisateur une incompréhension (« Je corrige » plutôt que « Vous vous êtes
trompé ») · préférer le mot concret au jargon · une question se répond en une
phrase · ne jamais annoncer une action externe sans l'étape de validation.

**Voice examples**

| Situation              | FR (default)                                                   | EN                                                               |
| ---------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Understanding shown    | « Voici ce que j'ai compris — dites-moi si c'est juste. »      | "Here's what I understood — tell me if that's right."            |
| Low confidence         | « Je ne suis pas sûr du tarif journalier. C'est bien 700 € ? » | "I'm not sure about the day rate. Is it €700?"                   |
| Correction accepted    | « C'est corrigé, merci. »                                      | "Fixed, thanks."                                                 |
| Before external action | « Je ne fais rien sans votre accord. Voici l'aperçu. »         | "I won't do anything without your go-ahead. Here's the preview." |

## i18n note (no premature framework)

Per the milestone decision: conversational copy is authored FR + EN, but **no
i18n library or translation architecture is added now**. To avoid scattering
strings, product-voice copy for conversational surfaces is centralized in a
single module when UX3 builds the components (proposed:
`src/lib/copy/` — a plain typed object keyed by locale, default `fr`), not
inlined ad hoc across components. A real i18n solution is a later, justified
decision.
