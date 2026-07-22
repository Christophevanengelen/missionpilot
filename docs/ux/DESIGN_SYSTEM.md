# Design System — "Studio calme" (hybridized with "Instrument technique")

Approved direction: **A — Studio calme** as the base, borrowing **C —
Instrument technique** conventions for dense views (tables, scores,
comparators, diagnostics). Premium without imitation: evokes the precision
of Linear, the sobriety of Vercel, the fluidity of Raycast and the clarity
of Notion — copies none of them, and uses no proprietary Tailwind Plus
code, component or asset.

Stack: Tailwind CSS v4 (CSS-first), shadcn/ui vendored components, Radix UI
primitives, Lucide icons, system font stacks (offline-safe). All tokens live
in `src/app/globals.css`; this document explains and constrains them.

## Color

Warm neutrals + **one** deep-ink accent. No secondary accent, no gradients,
no neon; the palette must never read as "AI purple".

| Token                                       | Role                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--background` / `--foreground`             | warm off-white page / near-black ink text                                                                                                                                                                                                                                      |
| `--card`, `--surface-raised`                | content surfaces; raised = header/nav/side panels                                                                                                                                                                                                                              |
| `--primary`                                 | deep ink (oklch hue 262, low chroma) — actions, active states                                                                                                                                                                                                                  |
| `--accent`                                  | whisper of ink — hover/selected surfaces                                                                                                                                                                                                                                       |
| `--muted-foreground`                        | secondary text (contrast ≥ 4.5:1 on background)                                                                                                                                                                                                                                |
| `--success` / `--warning` / `--destructive` | state colors, always paired with a label or icon (never color alone). On light backgrounds `--warning` (and, marginally, `--success`) meet only the ≥3:1 UI/large-text bar — use them as **badge fill / icon / large text only**, never for small body text on `--background`. |
| `--border` / `--input` / `--ring`           | hairline structure and focus                                                                                                                                                                                                                                                   |

Dark mode is native (class strategy via `next-themes`): same hues, inverted
lightness; borders become translucent foreground; the accent lightens
instead of saturating. Both modes are first-class — every component is
designed against both.

## Surfaces, borders, shadows

Surfaces are defined by **hairline borders** (`--border`, 1px), not shadows.
Shadows are reserved for **floating** elements (dialogs, popovers, the login
card, drag previews): `shadow-floating`. `shadow-hairline` outlines a
surface on busy backgrounds. Nothing else casts shadows.

## Radius

`--radius: 0.625rem` base (shadcn scale sm→4xl derived). Cards and inputs:
default. Chips and badges: full. Never mix radii inside one component.

## Typography

System stacks only (`--font-sans`, `--font-mono`, no downloaded fonts).
Scale: page title `text-2xl font-semibold tracking-tight` · section
`text-lg font-semibold` · body `text-sm` (conversation: `text-[15px]`
allowed for reading comfort) · caption `text-xs text-muted-foreground`.
**Dense-view convention (from direction C):** every numeric datum — scores,
latencies, counts, rates, ids — uses `font-mono tabular-nums`; table rows
tighten to `py-1.5` with `border-border/50` hairline separators.

## Spacing

Tailwind's default scale; constrained usage: card padding `p-4`/`p-6` ·
thread gap `gap-4` · in-card stack `gap-2`/`gap-3` · page gutter `p-6`
(mobile `p-4`). Generous whitespace is the default; density is a deliberate,
per-view decision (dense views only).

## Motion

Tokens: `--duration-fast: 120ms` (state feedback: hover, toggle, chip
selection) · `--duration-base: 160ms` (layout: cards entering the thread,
panel slide) · `--ease-soft`. Rules: subtle micro-interactions only; no
spectacular effects; every animation behind `motion-safe:`; the experience
must be fully usable with animations off (`prefers-reduced-motion`), which
is a tested requirement (`tests/e2e`), not an intention.

## Component states

Every interactive component defines: default · hover · focus-visible
(2px `--ring`, always visible) · active · disabled (reduced opacity + no
pointer, never color-only) · loading (skeleton or inline spinner + status
text) · error (message + recovery action). Card lifecycle states
(`proposed`/`confirmed`/`needs_review`/`rejected`) are specified in
`CONVERSATION_FRAMEWORK.md` and rendered as labelled badges, never as bare
color dots.

## Iconography

Lucide only, `size-4` inline / `size-5` in buttons, `aria-hidden` when
decorative, stroke width default. Icons support text; they never replace it
for state or meaning.

## Do / Don't

Do: one accent, hairline structure, mono numerals in dense views, calm
motion, both themes always. Don't: gradients, glassmorphism, neon, more
than one accent hue, shadows as decoration, animation without
`motion-safe:`, information carried by color alone.
