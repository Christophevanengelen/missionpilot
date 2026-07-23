# Accessibility

Target: **WCAG 2.2 AA**. Extends the Phase 0 accessibility work (skip link,
landmarks, focus restitution, axe scan, scripted keyboard journey in
`tests/e2e/`) to the conversational surfaces. Automated scans are a partial
check, never proof of conformance — a human keyboard + screen-reader pass is
required before any public release.

## Non-negotiable requirements

- **Full keyboard operation.** Every flow — including the whole conversation
  — is completable with Tab/Shift-Tab/Enter/Escape/arrows. No capability is
  keyboard-inaccessible; no drag-and-drop-only interaction.
- **Visible focus** on every interactive element (2px `--ring`), never
  removed, never color-only.
- **Logical tab order**: skip link → header (theme, sign out) → primary nav →
  main. In the thread: newest actionable card receives focus after a turn;
  order follows visual/reading order.
- **Contrast verified**: text ≥ 4.5:1, large text / UI components ≥ 3:1, in
  both themes. `--muted-foreground` and state colors are chosen to pass on
  their intended backgrounds.
- **Screen readers**: semantic landmarks (`header`/`nav`/`main`); the thread
  is a labelled list; new assistant turns and card state changes announce
  via a polite live region; the composer is a labelled form; card actions are
  real buttons with accessible names.
- **Reduced motion**: all animation behind `motion-safe:`; under
  `prefers-reduced-motion` the UI is fully usable with zero animation
  (cards appear instantly, panels toggle without slide).
- **Touch targets** ≥ 24×24px effective (44px recommended for primary
  actions); adequate spacing between adjacent targets.
- **No meaning by color alone**: every state (`proposed`/`confirmed`/
  `needs_review`/`rejected`, success/warning/error) carries a text label
  and/or icon in addition to color.
- **Conversation without animation or drag**: the entire experience works
  without motion and without pointer gestures.

## Per-component obligations

Defined alongside each entry in `COMPONENT_INVENTORY.md` (accessible name,
role, keyboard model, live-region behavior). The inventory is the source of
truth; this document sets the bar.

## Verification (each UX/feature PR)

- axe scan: zero serious/critical violations on all touched routes;
- scripted keyboard journey passes (skip link, tab order, focus visible,
  form operation, navigation, focus restitution after error);
- reduced-motion path exercised;
- manual screen-reader spot check before release (documented, not automated).

The UX Preview route (`/ux-preview`) is itself held to these requirements so
the foundation is proven, not merely asserted.
