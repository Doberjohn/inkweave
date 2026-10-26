---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.ts"
  - "packages/ui/src/**/*.tsx"
  - "packages/ui/src/**/*.ts"
---

# Design-token discipline (#508, milestone #4)

Two mechanisms enforce the token system; both run automatically:

1. **`inkweave/*` ESLint rules** (`apps/web/eslint-rules/index.js`, per-commit + CI): no raw hex colors, `rgba()`, font-family strings, font sizes, radii, spacing (padding, margin, gap), app-layer z-indexes (≥50), keyword/bezier easings, or `backdrop-filter` (WebKit E2E trap, #444/#445). Every message names the replacement token. **`no-adhoc-buttons`** (#509) additionally blocks any `<button style={…}>` in feature code: buttons come from the kit (`CtaButton` filled/ghost/neutral/pill, `LinkButton`, `TabList`, `IconButton`, `FiltersButton`, `Chip`); the exempt domain families (steppers, vote pickers, tile toggles) are listed in the rule itself. **`no-dim-text`** keeps `COLORS.textDim` off text (2.6:1 to 3.5:1 on every surface, WCAG 1.4.3): use `COLORS.textMuted`. textDim stays for borders, strokes, disabled states and `aria-hidden` decoration. **`no-unloaded-font-weight`** allows only weights with a self-hosted face: 400 to 700 for the body sans, and 400 for the hero serif (Marcellus has no bold cut), in any style object that names `FONTS.hero`. `font-synthesis: none` means any other weight silently renders as the nearest face. It can't see a heading that is bold by default, so a hero `<h1>`-`<h6>` sets `fontWeight: 400` itself, as `DIALOG_TITLE` does.
2. **Value-grep gate** (`check:design` → `scripts/check-design-tokens.mjs`, pre-push + CI): greps the LITERAL values of the tokens (theme hexes, EASING strings, font names) across ts/tsx/css/html — it catches `cssText` strings and quoted shorthands the AST cannot see. In `.css` and `.html`, which ESLint never reads, it also counts raw `rgb()`/`rgba()`, easing keywords, `cubic-bezier()` and 6- or 8-digit hexes no token declares (#546), in a baseline entry of their own (`apps/web/src/index.css (raw)`), so a raw value can't hide behind a token value the same change removed. In `.css` it also counts, one per declaration, the radii, font sizes, shadows and durations typed in where `RADIUS`, `FONT_SIZES`, `SHADOWS` or `DURATION` holds them (#1013, `scripts/css-scale-values.mjs`), in an entry of their own (`apps/web/src/index.css (scale)`): the radius properties, `font-size` and `font`, `box-shadow`, `text-shadow` and `filter`'s `drop-shadow()`, the transition and animation properties, their vendor-prefixed forms, and a custom property one of them reads in the same stylesheet. Zero, keywords, percentages, unitless numbers and `var()` never count, nor a decorative `infinite` animation's timings, which `DURATION`'s scope keeps literal, nor a negative delay. When a count grows, pass the token in through a CSS variable set from TypeScript, as `cardOverviewModalStyles.ts` sets `--focused-glow-low`, or style the element inline with it. `'Barlow'`, `'Tinos'` (the hero serif before Marcellus) and `backdrop-filter:` usage are zero-tolerance tripwires, which also read the text files in `public/` and `e2e/` (#912), with no baseline, skipping `public/data` and the git-ignored `public/mockups`. Both mechanisms cover inkweave-ui (`packages/ui/src`) as they cover the app: the package lints with the app's config, and the gate scans its source, reading its needles from the files `TOKEN_FILES` lists.

## When a rule fires on you

- Use the token it names: `COLORS.*` / `INK_COLORS.*` / `TIER_COLORS.*`, `hexRgba(COLORS.x, a)` / `blackRgba` / `whiteRgba` / `COLORS.scrim`, `FONTS.*`, `FONT_SIZES.*` (display tier exists: `displaySm/Md/Lg`), `RADIUS.*` (incl. `pill`), `SPACING.*` (`xxs`..`xxxl`; `0` is always fine), `Z_INDEX.*` (incl. `toast`/`swUpdate`), `EASING.snappy` (hover/fast) / `bounce` (selection/press) / `smooth` (fades/progress), `SHADOWS.*`.
- If NO token fits, that is a design-system gap: raise it with the owner, do not inline the value. Scale additions require a ruling, not a headcount (census-vs-law).

## The grandfather ledger

`apps/web/eslint-rules/known-offenders.js` lists pre-enforcement files per rule, each by its repo path (`apps/web/src/...` or `packages/ui/src/...`), which matches that one file only; the rules' exemptions (`eslint-rules/exemptions.js`) name paths the same way. It ONLY SHRINKS: when you touch a listed file, converge its violations to tokens and remove its entry. Never add entries. The value gate's baseline (`scripts/known-design-values.json`) works the same way — counts may only decrease (`--update-baseline` after shrinking). `eslint-rules/ledgers.test.js` caps both totals (and, with `exemptions.test.js`, fails on a row or key whose file no longer exists): lower a ceiling when you remove an entry, never raise one.

## The micro-pattern consts (#511)

One source per retyped idiom, in inkweave-ui's `tokens/theme.ts` (Storybook: Docs/MicroPatterns). Spread, then override:
`CAP_LABEL` / `CAP_LABEL_XS` (uppercase section labels; `LETTER_SPACING.cap`/`.eyebrow`), `SURFACE_CARD` (radius rule: `RADIUS.card` standalone panels, `RADIUS.lg` nested cards), `EMPTY_BOX` (centered dashed empty states — NOT prose notices), `TRUNCATE` (needs ancestor `minWidth: 0`), `TABULAR` (any numeral column that must not jitter), `VISUALLY_HIDDEN` (screen-reader-only text, such as a chip's card name or a heading the layout implies; never a local copy), `GOLD_GLOW` (the one-gold selection/hover/focus recipe — never hand-mix gold alphas), `TOUCH_TARGET`, `ICON_SIZE`, `PRESS_SCALE`, `DISABLED_STYLE`. Dynamic playstyle accents compose via `accentRgba` (playstyleUi.ts).

## Interaction conventions (#511)

- **Selection is border + glow (GOLD_GLOW), never `outline`**; the focus ring is never suppressed without a visible replacement (`GOLD_GLOW.focusRing`).
- **Disabled** = `DISABLED_STYLE`, everywhere. **Press** = `scale(${PRESS_SCALE})`.
- **EASING intent**: `snappy` hover/fast, `bounce` selection/press, `smooth` fades/progress.
- **Reduced motion**: one source — `inkweave-ui/utils/prefersReducedMotion` (fn for trigger-time, hook for render gating). No new hand-rolled `matchMedia` checks; a new infinite animation MUST have a class in its own stylesheet's reduced-motion block (the app's `index.css`, or the package's `styles/primitives.css`). `useBoop` is already guarded.
- **Loading states**: skeleton for layout-known surfaces (one app-level `SkeletonTheme` in AppLayout — never add local wrappers), text for unknown shapes, spinner only for the SW toast. Card art is the exception: while a card's art loads, its place holds `InkCardPlaceholder` (inkweave-ui's `lorcana/`), never a grey `Skeleton`. Pass the card's `ink` and `ink2` once the card is known; before that (a card list still loading), pass none for the neutral tile. Its parent sets the size and corner radius. Like every placeholder it is static (#639).
- **`surfaceHover` is overloaded** (six jobs); do not add new ones — aliases are deferred to a future ruling.

## Related

- **`no-raw-spacing` is `'error'`** (#549, 2026-10-22). It reads `padding`, `margin`,
  `gap` and their longhand and logical forms (`paddingTop`, `paddingInline`,
  `marginBlockStart`…), negative values (`marginTop: -14`; `-SPACING.md` passes),
  and both branches of a ternary (`gap: isMobile ? 8 : 12`). Its ledger was seeded
  the day it turned on, from a measured run: 66 files, 191 values. Stories and
  inkweave-ui's `src/docs/` are exempt, like tests (owner ruling, 2026-07-31: their padding is
  scaffolding, not product). `theme.ts` is not, unlike for the color rules: its one
  value, `VISUALLY_HIDDEN`'s `margin: -1`, is in the ledger (owner, 2026-10-22).
- **Spacing in a string is invisible.** `padding: '0 14px'` is text to the rule, and
  the value gate greps token values, so a quoted shorthand's numbers pass both, and so
  does a value kept under another name (`pagePadding`, a function that returns `'6px'`)
  or passed as a prop (`gridGap={10}`). Put tokens in a shorthand
  (`` padding: `${SPACING.sm}px ${SPACING.md}px` ``). **#548** converted them in every
  file deck-builder never touched; the files it changed wait for its ports. Keyword and
  percentage values (`'0 auto'`, `'50%'`, `calc()`) stay strings.
- **Off-scale values snap to the nearest step** (owner, 2026-10-20), with shots. A value
  halfway between two steps (6, 10, 18, 28) takes the larger one, unless that breaks a
  relationship it had: a ternary's branches stay apart (#865), a shorthand's sides keep
  their order, a series keeps shrinking, and a skeleton moves with the layout it mirrors.
  Only a value past the top step (40, 48, 80) or a 1px hairline gets a named const, with
  a comment saying why; never arithmetic on a token (`SPACING.sm - 2`).
- Token declaration sites (inkweave-ui's `tokens/`, the app's `playstyleUi.ts`, and the collection binder's `binderLook.ts`, kept beside the binder so its look loads with it, #941), inkweave-ui's `src/docs/` stories, tests, and the five SVG icon components are permanently exempt from the color rules.
- Import tokens through the barrel (`shared/constants`), never the token files directly: not `inkweave-ui/tokens/*`, `appConstants.ts` or `playstyleUi.ts` (`no-restricted-imports` enforces). Only the barrel's own folder imports them, and inkweave-ui's source imports `../tokens/theme`.
