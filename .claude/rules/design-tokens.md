---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.ts"
---

# Design-token discipline (#508, milestone #4)

Two mechanisms enforce the token system; both run automatically:

1. **`inkweave/*` ESLint rules** (`apps/web/eslint-rules/index.js`, per-commit + CI): no raw hex colors, `rgba()`, font-family strings, font sizes, radii, spacing (padding, margin, gap), app-layer z-indexes (≥50), keyword/bezier easings, or `backdrop-filter` (WebKit E2E trap, #444/#445). Every message names the replacement token. **`no-adhoc-buttons`** (#509) additionally blocks any `<button style={…}>` in feature code: buttons come from the kit (`CtaButton` filled/ghost/neutral/pill, `LinkButton`, `TabList`, `IconButton`, `FiltersButton`, `Chip`); the exempt domain families (steppers, vote pickers, tile toggles) are listed in the rule itself. **`no-dim-text`** keeps `COLORS.textDim` off text (2.6:1 to 3.5:1 on every surface, WCAG 1.4.3): use `COLORS.textMuted`. textDim stays for borders, strokes, disabled states and `aria-hidden` decoration.
2. **Value-grep gate** (`check:design` → `scripts/check-design-tokens.mjs`, pre-push + CI): greps the LITERAL values of the tokens (theme hexes, EASING strings, font names) across ts/tsx/css/html — it catches `cssText` strings and quoted shorthands the AST cannot see. `'Barlow'` and `backdrop-filter:` usage are zero-tolerance tripwires.

## When a rule fires on you

- Use the token it names: `COLORS.*` / `INK_COLORS.*` / `TIER_COLORS.*`, `hexRgba(COLORS.x, a)` / `blackRgba` / `whiteRgba` / `COLORS.scrim`, `FONTS.*`, `FONT_SIZES.*` (display tier exists: `displaySm/Md/Lg`), `RADIUS.*` (incl. `pill`), `SPACING.*` (`xxs`..`xxxl`; `0` is always fine), `Z_INDEX.*` (incl. `toast`/`swUpdate`), `EASING.snappy` (hover/fast) / `bounce` (selection/press) / `smooth` (fades/progress), `SHADOWS.*`.
- If NO token fits, that is a design-system gap: raise it with the owner, do not inline the value. Scale additions require a ruling, not a headcount (census-vs-law).

## The grandfather ledger

`apps/web/eslint-rules/known-offenders.js` lists pre-enforcement files per rule. It ONLY SHRINKS: when you touch a listed file, converge its violations to tokens and remove its entry. Never add entries. The value gate's baseline (`scripts/known-design-values.json`) works the same way — counts may only decrease (`--update-baseline` after shrinking).

## The micro-pattern consts (#511)

One source per retyped idiom, in `theme.ts` (Storybook: Docs/MicroPatterns). Spread, then override:
`CAP_LABEL` / `CAP_LABEL_XS` (uppercase section labels; `LETTER_SPACING.cap`/`.eyebrow`), `SURFACE_CARD` (radius rule: `RADIUS.card` standalone panels, `RADIUS.lg` nested cards), `EMPTY_BOX` (centered dashed empty states — NOT prose notices), `TRUNCATE` (needs ancestor `minWidth: 0`), `TABULAR` (any numeral column that must not jitter), `VISUALLY_HIDDEN` (screen-reader-only text, such as a chip's card name or a heading the layout implies; never a local copy), `GOLD_GLOW` (the one-gold selection/hover/focus recipe — never hand-mix gold alphas), `TOUCH_TARGET`, `ICON_SIZE`, `PRESS_SCALE`, `DISABLED_STYLE`. Dynamic playstyle accents compose via `accentRgba` (playstyleUi.ts).

## Interaction conventions (#511)

- **Selection is border + glow (GOLD_GLOW), never `outline`**; the focus ring is never suppressed without a visible replacement (`GOLD_GLOW.focusRing`).
- **Disabled** = `DISABLED_STYLE`, everywhere. **Press** = `scale(${PRESS_SCALE})`.
- **EASING intent**: `snappy` hover/fast, `bounce` selection/press, `smooth` fades/progress.
- **Reduced motion**: one source — `shared/utils/prefersReducedMotion` (fn for trigger-time, hook for render gating). No new hand-rolled `matchMedia` checks; new infinite animations MUST have a class in index.css's reduced-motion block. `useBoop` is already guarded.
- **Loading states**: skeleton for layout-known surfaces (one app-level `SkeletonTheme` in AppLayout — never add local wrappers), text for unknown shapes, spinner only for the SW toast.
- **`surfaceHover` is overloaded** (six jobs); do not add new ones — aliases are deferred to a future ruling.

## Related

- **`no-raw-spacing` is `'error'`** (#549, 2026-10-22). It reads `padding`, `margin`,
  `gap` and their longhand and logical forms (`paddingTop`, `paddingInline`,
  `marginBlockStart`…), negative values (`marginTop: -14`; `-SPACING.md` passes),
  and both branches of a ternary (`gap: isMobile ? 8 : 12`). Its ledger was seeded
  the day it turned on, from a measured run: 65 files, 190 values. Stories and
  `src/docs/` are exempt, like tests (owner ruling, 2026-07-31: their padding is
  scaffolding, not product), and so is `theme.ts`, which declares the tokens, as
  for the color rules.
- **Spacing in a string is invisible.** `padding: '0 14px'` is text to the rule, and
  the value gate greps token values, so a quoted shorthand's numbers pass both. Put
  tokens in a shorthand (`` padding: `${SPACING.sm}px ${SPACING.md}px` ``); **#548**
  converts the quoted px shorthands still in production code. Keyword and
  percentage values (`'0 auto'`, `'50%'`, `calc()`) stay strings.
- Token declaration sites (`theme.ts`, `playstyleUi.ts`), `src/docs/` stories, tests, and the five SVG icon components are permanently exempt from the color rules.
- Import tokens through the barrel (`shared/constants`), never the theme files directly (`no-restricted-imports` enforces).
