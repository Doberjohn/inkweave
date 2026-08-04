---
paths: "apps/web/src/**/*.tsx"
---

# Overlay contract (#510, milestone #4)

Every overlay honors ONE contract: focus trap + Escape + focus restore, body
scroll lock, token scrim that closes on click, enter/exit presence, named
Z_INDEX tier. `inkweave/no-unshelled-dialogs` enforces the entry point
mechanically: `aria-modal` in a file that imports neither `DialogShell` /
`BottomSheet` nor `useDialogFocus` is an error.

## How to build an overlay

- **Centered dialog** → `<DialogShell>` (`shared/components/DialogShell.tsx`):
  portal, scrim (`COLORS.scrim`, `scrim="heavy"` for lightboxes), size presets
  sm/md/lg, `layer` tiers (`modal` / `underModal` / `lightbox`), hook trio
  wired, reduced-motion-safe unmount. `panelStyle` overrides the panel;
  `transition="none"` when the content owns its choreography (MobileLightbox's
  FLIP wires the trio directly instead — the sanctioned escape valve).
- **Bottom sheet** → `<BottomSheet>` chrome (scrim, drag handle, slide-up,
  `SHADOWS.sheet`, safe-area inset) + the hook trio in the consumer.
- **Toast / status** → `role="status"` + `aria-live="polite"`, `Z_INDEX.toast`
  (or `swUpdate`); never `aria-modal`, never a trap.
- **Tooltip / popover** → `role="tooltip"`, `pointerEvents: none`,
  `Z_INDEX.popover`.

## Rulings (binding)

- **Every centered dialog shows a close ×**, supplied by `DialogShell` itself
  (`showClose`, default true). Escape needs a keyboard and backdrop-tap is
  undiscoverable, so a touch user otherwise has no visible way out. It is STICKY
  in a zero-height row: reachable at any scroll position without shifting the
  content below it. Opt out only when the content already carries one in a
  designed header (`FranchiseCardsModal`), with a comment saying so.
  - Do NOT add a second dismissal named "Close" beside it. Two controls sharing
    one accessible name read as two different actions; `ScoreMathModal`'s
    full-width Close was removed for exactly this.
- **Dialog copy uses `DIALOG_TITLE` / `DIALOG_BODY`** from `theme.ts`, not
  per-dialog inline fonts. Weight is a house decision, and eleven inline copies
  meant changing it was an eleven-file edit with a twelfth waiting to diverge.
- **Backdrop click ALWAYS closes.** `disableBackdropClose` exists as an escape
  hatch but requires a written justification comment at the call site.
- **No `backdrop-filter` on scrims, ever** (WebKit E2E repaint hang, #444/#445).
  Deepen the solid scrim instead.
- **Scrims are tokens**: `COLORS.scrim` / `COLORS.scrimHeavy` only.
- **FilterDialog stays Radix** (the one exception, named in the lint rule):
  Radix supplies trap/lock/Escape/outside-close natively; do not add a second
  Radix dialog without an owner ruling.

## E2E contract (do not break)

- Backdrop close is an `onClick` ON the scrim element — specs dismiss via
  `dispatchEvent('click')` on backdrop testids (`card-overview-backdrop`,
  `search-sheet-backdrop`, `mechanics-sheet-backdrop`). Pointer-down-outside
  listeners silently break them.
- Scroll lock sets **body** inline `overflow` (card-detail asserts it exactly).
- Closed dialogs UNMOUNT (`toHaveCount(0)` assertions) — DialogShell's
  fallback timer guarantees this under `prefers-reduced-motion`.
- Existing dialog testids and aria-labels are load-bearing; preserve them
  through any migration.
