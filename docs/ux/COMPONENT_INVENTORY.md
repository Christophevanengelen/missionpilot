# Component Inventory

The components the conversational experience needs, each with its states and
accessibility obligations. **Scope discipline:** only components consumed by
Phases 1-2 (and the UX Preview) are specified as build-now; the rest are
marked _deferred_ so the system doesn't speculate. All are composed from
shadcn/ui + Radix primitives — no new UI dependency, no Radix replacement, no
proprietary Tailwind Plus component.

## Proposed React structure

```text
src/components/
  ui/                     # vendored shadcn primitives (exists)
  conversation/           # the thread and its turn parts
    thread.tsx            # list container, live-region announcements
    turn.tsx              # one assistant/user contribution
    composer.tsx          # labelled input + send
    suggestion-chips.tsx  # optional shortcut chips
  cards/                  # in-thread structured proposals
    card-shell.tsx        # shared frame: title, state badge, actions row
    understanding-card.tsx
    evidence-card.tsx
    opportunity-card.tsx
    score-card.tsx        # explainable, component-by-component
    approval-card.tsx     # external-action gate
  context/
    context-summary.tsx   # "what MissionPilot understood" + progress
    state-badge.tsx       # proposed/confirmed/needs_review/rejected
    progress-indicator.tsx
  shell/                  # already partly built (nav-link, theme-toggle)
src/lib/copy/             # centralized product-voice copy (fr default, en)
```

Rationale: `card-shell` factors the frame + state badge + action row so every
card is consistent and states are rendered one way. Cards are presentational
and prop-driven — they carry no data-fetching, so they are reusable by the
real Phase 1-4 features and by the mock-only UX Preview alike (no throwaway).

## Components

Each entry: purpose · states · a11y obligations. States always include the
universal set (default/hover/focus-visible/active/disabled where interactive)
plus the ones listed.

### conversation/thread — build-now

- Purpose: ordered list of turns; the primary surface.
- States: loading (skeleton turns) · empty (opening prompt) · error (calm
  message + retry) · offline (non-blocking banner) · populated.
- a11y: `role` list semantics; labelled region; **polite live region** for new
  assistant turns and card state changes; manages focus to the newest
  actionable card after a turn; fully keyboard-scrollable.

### conversation/composer — build-now

- Purpose: language input + send.
- States: idle · typing · submitting (disabled + status) · error (retained
  input + retry) · offline (disabled with reason).
- a11y: labelled textarea; Enter to send / Shift-Enter newline documented;
  send is a real button with an accessible name; never traps focus.

### conversation/suggestion-chips — build-now

- Purpose: optional one-tap shortcuts for the current turn.
- States: default · selected · disabled.
- a11y: real buttons in a labelled group; keyboard-navigable; not the only way
  to proceed (the composer always works).

### cards/card-shell — build-now

- Purpose: shared frame — title, `state-badge`, body slot, action row.
- States: reflects the card lifecycle (`proposed`/`confirmed`/`needs_review`/
  `rejected`) via the badge; loading; error.
- a11y: heading for the title; actions are buttons with names including
  context ("Confirmer le profil", not just "Confirmer"); state conveyed by
  badge **text**, not color alone.

### cards/understanding-card, evidence-card, opportunity-card — build-now

- Purpose: the P1 proposals (Flows 1-3, 5).
- States: the four lifecycle states; each field may show `needs_review`
  inline (e.g. an unverified metric).
- a11y: label-value pairs are programmatically associated; per-field
  confidence/warnings have text, not just an icon.

### cards/score-card — build-now

- Purpose: explainable score, component by component (Flow 6).
- States: proposed (inspect) · needs_review (low confidence).
- a11y: each component row is a labelled meter with a **text** value
  (`aria-valuenow` + visible number), links to its evidence; score and
  confidence are separate, labelled values; no meaning by bar color alone.

### cards/approval-card — build-now (pattern), gated use later

- Purpose: external-action approval (Flow 8).
- States: default · approve-disabled (with named reason when unverified
  claims exist).
- a11y: decline is a first-class button at least as prominent as approve;
  dialog semantics if modal; Escape declines; the disabled-approve reason is
  announced.

### context/state-badge — build-now

- Purpose: render a lifecycle state consistently.
- States: one per lifecycle value.
- a11y: text label always present; color is secondary; sufficient contrast in
  both themes.

### context/context-summary + progress-indicator — build-now

- Purpose: running "what MissionPilot understood" + non-intrusive progress.
- States: empty · partial · complete.
- a11y: landmark/region; progress has text (`x % complete`), never a bare bar;
  desktop side panel / mobile top sheet per `RESPONSIVE_STRATEGY.md`.

### shell/nav-link, theme-toggle — built (UX0)

- Already implemented; states and a11y verified in UX0.

### comparator, opportunity-inbox-table — _deferred_ (Phase 3)

- Dense-view components (direction C). Specified when opportunity ingestion
  lands; listed here so the structure anticipates them without building them.

### application-workspace (split view) — _deferred_ (Phase 4)

- Per `docs/UX_SPEC.md`; approval control disabled while unverified claims
  exist.

## Universal state coverage

Every build-now component must ship loading, empty, error, offline and retry
states where applicable, in the product voice, and pass the per-component
a11y obligations above plus the global bar in `ACCESSIBILITY.md`. The UX
Preview route demonstrates the build-now set against mock data.
