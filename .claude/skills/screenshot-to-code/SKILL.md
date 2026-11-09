---
name: screenshot-to-code
description: Convert a screenshot, mockup, Figma export or screen recording into React + Tailwind components for HaciendoHabito, using the app's own tokens and v2 components. Use when the user shares an image of a design (theirs, a reference app, a hand sketch) and wants it built, or wants several design variants of a screen to compare.
---

# Screenshot to code (HaciendoHabito)

Process adapted from abi/screenshot-to-code. That project is a separate app (FastAPI + React) that needs
OpenAI/Gemini/Anthropic API keys. Here the model reads the image directly, so nothing runs outside the
repo and the result lands as real components in the codebase, not as a standalone HTML file.

## 1. Read the image before writing code

Write down, in this order:
1. **Layout:** columns, regions, what scrolls, what is fixed. Approximate widths in px at the image's size.
2. **Hierarchy:** the one thing the eye goes to first, then second and third.
3. **Components:** map each piece to what exists: `src/components/v2/ui.tsx` (MetricCardV2 and others),
   `src/components/ui/*` (Button, Modal, SegmentedControl, Tabs, Badge, EmptyState, Skeleton...).
   Only build something new when nothing fits, and say so.
4. **Text:** copy every visible string exactly (Spanish rioplatense, the app's voice). Never lorem ipsum.
5. **Colours and type:** map each colour to a token (`ink-*`, `surface-*`, `brand-*`, `status-*`).
   A colour with no token is a decision to raise, not a hex to paste. Known v2 traps: `status-generated`
   is grey-violet and `brand-primary` is violet in light mode; for green/yellow/orange states use the
   explicit hexes already used in the app (#22A55A, #F5C542, #F26B1D).
6. **States the image does not show:** empty, loading, error, long names, 0 and many items, mobile.

## 2. Build

- v2 only: gate with `IS_V2` from `@/lib/uiVersion`; v1 must not change.
- Tailwind with the project's tokens; dark mode must work (`dark:` or token-based).
- Real data from the existing hooks/repos (`src/data/*`, `src/hooks/*`); do not invent fields.
  If the design needs data that does not exist, list it as a gap.
- Mobile first at 390 px, then 768 and 1280.

## 3. Variants (when asked for options)

Produce 2 or 3 genuinely different takes, not colour swaps: change the layout model (list vs cards vs
table), the density, or what leads (number, person, action). Name each by its idea in one line and
state the trade-off. Build them behind a temporary switch or in the local harness, screenshot all of
them side by side and let the user pick before cleaning up.

## 4. Compare against the source

Run the local harness (see memory `haciendohabito-forma-de-trabajo`), take screenshots at the image's
width with Playwright (`playwright-cli` or the mytools-app Playwright with `channel: 'msedge'`), and put
the result next to the original. List the differences that remain and fix them or say why they stay.
