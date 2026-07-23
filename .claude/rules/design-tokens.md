---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.ts"
---

# Design-token discipline (#508, milestone #4)

Two mechanisms enforce the token system; both run automatically:

1. **`inkweave/*` ESLint rules** (`apps/web/eslint-rules/index.js`, per-commit + CI): no raw hex colors, `rgba()`, font-family strings, font sizes, radii, app-layer z-indexes (≥50), keyword/bezier easings, or `backdrop-filter` (WebKit E2E trap, #444/#445). Every message names the replacement token. **`no-adhoc-buttons`** (#509) additionally blocks any `<button style={…}>` in feature code: buttons come from the kit (`CtaButton` filled/ghost/neutral/pill, `LinkButton`, `TabList`, `IconButton`, `FiltersButton`, `Chip`); the exempt domain families (steppers, vote pickers, tile toggles) are listed in the rule itself.
2. **Value-grep gate** (`check:design` → `scripts/check-design-tokens.mjs`, pre-push + CI): greps the LITERAL values of the tokens (theme hexes, EASING strings, font names) across ts/tsx/css/html — it catches `cssText` strings and quoted shorthands the AST cannot see. `'Barlow'` and `backdrop-filter:` usage are zero-tolerance tripwires.

## When a rule fires on you

- Use the token it names: `COLORS.*` / `INK_COLORS.*` / `TIER_COLORS.*`, `hexRgba(COLORS.x, a)` / `blackRgba` / `whiteRgba` / `COLORS.scrim`, `FONTS.*`, `FONT_SIZES.*` (display tier exists: `displaySm/Md/Lg`), `RADIUS.*` (incl. `pill`), `Z_INDEX.*` (incl. `toast`/`swUpdate`), `EASING.snappy` (hover/fast) / `bounce` (selection/press) / `smooth` (fades/progress), `SHADOWS.*`.
- If NO token fits, that is a design-system gap: raise it with the owner, do not inline the value. Scale additions require a ruling, not a headcount (census-vs-law).

## The grandfather ledger

`apps/web/eslint-rules/known-offenders.js` lists pre-enforcement files per rule. It ONLY SHRINKS: when you touch a listed file, converge its violations to tokens and remove its entry. Never add entries. The value gate's baseline (`scripts/known-design-values.json`) works the same way — counts may only decrease (`--update-baseline` after shrinking).

## Related

- Spacing rule exists but is `'off'` until the convergence sweep (#508 Step 6; #511 owns the sweep).
- Token declaration sites (`theme.ts`, `playstyleUi.ts`), `src/docs/` stories, tests, and the five SVG icon components are permanently exempt from the color rules.
- Import tokens through the barrel (`shared/constants`), never the theme files directly (`no-restricted-imports` enforces).
