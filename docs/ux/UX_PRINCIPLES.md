# UX Principles

Extends `docs/UX_SPEC.md` (experience principles, navigation, screen specs) —
read it first; nothing here overrides it. This document adds the
**conversational paradigm** that Phases 1-4 must implement.

> Sibling documents referenced below are authored across this UX Foundation
> milestone: `CONVERSATION_FRAMEWORK.md` (UX1), `USER_FLOWS.md` (UX2),
> `COMPONENT_INVENTORY.md` (UX3), and the `/ux-preview` route (built with
> UX3). Until each lands, its references are forward pointers.

## The paradigm

MissionPilot is a **career copilot that conducts an ongoing interview**, not
an application to fill in. Conversation is the _input method_; cards and
structured views are the _verifiable memory_; the explained score with
evidence is the _currency of trust_.

```text
conversation turn ──▶ structured proposal (card) ──▶ user decision
                                                      confirm / correct /
                                                      ignore / go deeper
```

Every meaningful exchange crystallizes into a card the user can act on. The
UI switches to structured views (tables, comparators) when density beats
conversation, and returns to conversation for nuance and decisions.

## Operating principles (binding for Phases 1-4)

1. **One important question at a time.** A turn never stacks two decisions.
   Secondary details ride along as editable card fields, not questions.
2. **Natural, direct, reassuring language.** French by default, English
   supported. Writing rules: `CONVERSATION_FRAMEWORK.md` §Writing.
3. **Show what was understood, immediately.** Every extraction renders an
   "understanding" card in the thread (state `proposed`) before anything
   else depends on it.
4. **Frictionless correction.** Confirm / correct / ignore / go-deeper are
   one-tap actions on every proposal. Correction never requires re-typing
   everything, and never punishes the user for the system's mistake.
5. **Conversation becomes data, progressively.** Cards map 1:1 to domain
   entities (profile fields, evidence items, preferences, opportunities).
   No shadow state that only lives in chat history.
6. **Never ask twice.** Anything `confirmed` is known; asking again is a
   defect (memory contract: `CONVERSATION_FRAMEWORK.md` §Memory).
7. **Evidence with every claim.** Recommendations and scores always carry
   their evidence references and an explanation — reusing the agent-output
   envelope (`schemas/agent-output.schema.json`) and its `evidence[]`.
8. **No external action without explicit human validation.** The approval
   card is the only path to any outward effect (ADR-0002). Silence is never
   consent.
9. **Rich conversation, not a bare chatbot.** Cards, selectors, comparators
   and quick actions live inside the thread; the composer is for language.
10. **Switch views when conversation stops being the best tool.** Triggers
    and mechanics: `CONVERSATION_FRAMEWORK.md` §Switching.

## What MissionPilot must never look like

An administrative grey dashboard · a chatbot glued in a corner · a run of
long forms · a visual copy of any competitor · a neon-purple "AI product"
cliché.

## Mandatory UX criteria for Phases 1-4

Every feature PR must satisfy — and its reviewers must check:

- [ ] New user-facing capability is reachable conversationally (or documents
      why a structured view is the primary surface).
- [ ] Every AI-derived value surfaces as a card with state
      (`proposed`/`confirmed`/`needs_review`/`rejected`) and its actions.
- [ ] Claims display their evidence references; scores are explainable
      component by component (PRD §6).
- [ ] No known information is asked again.
- [ ] External effects go through the approval card; the "cancel/decline"
      path is as prominent as the approve path.
- [ ] Loading, empty, error, offline and retry states exist and are written
      in the product voice.
- [ ] Keyboard-only path verified; axe scan clean (serious/critical);
      `motion-safe`/`motion-reduce` respected.
- [ ] Mobile and desktop layouts verified per `RESPONSIVE_STRATEGY.md`.

These criteria are enforced via the "UX criteria" section of the PR template
(`.github/pull_request_template.md`), applied to any user-facing change.
