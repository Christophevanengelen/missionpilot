# Responsive Strategy

Mobile-first conversation; desktop adds a context panel. One component set,
two layouts — no separate mobile app, no duplicated components.

## Breakpoints (Tailwind defaults)

- **base (< 640px)** — mobile: single column, conversation full-width.
- **sm/md** — tablet: conversation full-width, context available on demand.
- **lg (≥ 1024px)** — desktop: conversation + persistent context panel.

## Layout by surface

### Conversation (primary surface, all phases)

- **Mobile**: full-width thread; composer docked at the bottom (safe-area
  aware); the context/"understood so far" summary is a top sheet opened by a
  button, not always-on. Cards are full-width, stacked.
- **Desktop**: centered thread (max ~`48rem` for readability) + a right
  **context panel** (`lg:` and up) holding the running "what MissionPilot
  understood" summary and non-intrusive progress. The panel is collapsible;
  its content is never the _only_ place information lives (it mirrors thread
  cards).

### Dense views (inbox, comparator, diagnostics)

- **Mobile**: cards/rows collapse to a vertical, label-value layout
  (`docs/UX_SPEC.md` "tables support responsive alternatives"); horizontal
  scroll is avoided; the comparator becomes a stacked, swipe-free carousel of
  labelled sections.
- **Desktop**: true tables (direction C conventions: mono numerals, hairline
  rows) and side-by-side comparison.

### Application workspace (Phase 4)

- **Desktop**: the UX_SPEC split view (requirements/evidence · editor ·
  verification).
- **Mobile**: the three panes become tabs; the approval control stays
  disabled while unsupported claims exist, on both.

## Navigation

- **Mobile**: primary nav in a top sheet / bottom tab affordance (real
  buttons, keyboard reachable, `aria-current` on the active item); theme
  toggle and sign-out in the header.
- **Desktop**: persistent left sidebar (current shell), `aria-current` active
  state, hairline divider.

## Rules

- No information exclusively in a hover state (unreachable on touch).
- Touch targets meet `ACCESSIBILITY.md` sizing.
- The context panel is an enhancement, never a requirement: everything it
  shows is also reachable in the thread, so a narrow viewport loses no
  capability.
- Reflow, not horizontal scroll, at every breakpoint (WCAG 1.4.10).
