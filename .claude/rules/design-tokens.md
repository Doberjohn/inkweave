---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.ts"
---

# Design-token discipline (#508, milestone #4)

Two mechanisms enforce the token system; both run automatically:

1. **`inkweave/*` ESLint rules** (`apps/web/eslint-rules/index.js`, per-commit + CI): no raw hex colors, `rgba()`, font-family strings, font sizes, radii, app-layer z-indexes (≥50), keyword/bezier easings, `backdrop-filter` (WebKit E2E trap, #444/#445), or **legacy gold** (`no-legacy-gold`: `COLORS.primary500/600/700`). Every message names the replacement token. **`no-adhoc-back-links`** (2026-08-07) blocks a hand-rolled `← ` / `Back to …` in a file that
does not import `BackLink` — see [`navigation.md`](navigation.md) for the census that motivated it and
the three exemption families. **`no-adhoc-buttons`** (#509) additionally blocks any `<button style={…}>` in feature code: buttons come from the kit (`CtaButton` filled/ghost/neutral/pill, `LinkButton`, `TabList`, `IconButton`, `FiltersButton`, `Chip`); the exempt domain families (steppers, vote pickers, tile toggles) are listed in the rule itself.
2. **Value-grep gate** (`check:design` → `scripts/check-design-tokens.mjs`, pre-push + CI): greps the LITERAL values of the tokens (theme hexes, EASING strings, font names) across ts/tsx/css/html — it catches `cssText` strings and quoted shorthands the AST cannot see. `'Barlow'` and `backdrop-filter:` usage are zero-tolerance tripwires.

## When a rule fires on you

- Use the token it names: `COLORS.*` / `INK_COLORS.*` / `TIER_COLORS.*`, `hexRgba(COLORS.x, a)` / `blackRgba` / `whiteRgba` / `COLORS.scrim`, `FONTS.*`, `FONT_SIZES.*` (display tier exists: `displaySm/Md/Lg`), `RADIUS.*` (incl. `pill`), `Z_INDEX.*` (incl. `toast`/`swUpdate`), `EASING.snappy` (hover/fast) / `bounce` (selection/press) / `smooth` (fades/progress), `DURATION.fast` (150) / `base` (200) / `slow` (300), `SHADOWS.*`.
- If NO token fits, that is a design-system gap: raise it with the owner, do not inline the value. Scale additions require a ruling, not a headcount (census-vs-law).

## One gold (`no-legacy-gold`)

`COLORS.primary` (`#ffb900`) is THE brand gold. `primary500`/`600`/`700` are the legacy accent (`#d4af37`; 500 and 600 are the SAME hex) and are ledgered, not legal — 28 files / 60 refs at seeding. `primary100`/`200` are gold-tinted dark BACKGROUNDS and stay legal.

This needed a third rule shape (`makeMemberRule`) because a deprecated *token* is invisible to both existing mechanisms by construction: `no-raw-hex-colors` scans string literals and a `MemberExpression` is not one, and the value-grep gate greps hexes parsed out of `theme.ts` while a token reference carries no hex. The ruling was prose-only from 2026-07-22 until 2026-07-29 and it was **losing** — commit `f541458f`, three days after milestone #4 merged, net-added a fresh reference. A ruling with no mechanism is a suggestion.

## The grandfather ledger

`apps/web/eslint-rules/known-offenders.js` lists pre-enforcement files per rule. It ONLY SHRINKS: when you touch a listed file, converge its violations to tokens and remove its entry. Never add entries.

**The one sanctioned exception is a RULE widening.** When a rule's visitor changes shape it exposes pre-existing code it could never see, and its ledger must be re-seeded from a measured run — that growth is the rule catching up, not drift advancing. It happened once, to `no-raw-easing` (2026-07-29, 14 → 23 files). Requirements: measure with the ledger emptied, hand-inspect every reported line for false positives, and say so in the ledger comment. Shrink-only resumes immediately after. The value gate's baseline (`scripts/known-design-values.json`) works the same way — counts may only decrease (`--update-baseline` after shrinking).

## The micro-pattern consts (#511)

One source per retyped idiom, in `theme.ts` (Storybook: Docs/MicroPatterns). Spread, then override:
`CAP_LABEL` / `CAP_LABEL_XS` (uppercase section labels; `LETTER_SPACING.cap`/`.eyebrow`), `SURFACE_CARD` (radius rule: `RADIUS.card` standalone panels, `RADIUS.lg` nested cards), `EMPTY_BOX` (centered dashed empty states — NOT prose notices), `TRUNCATE` (needs ancestor `minWidth: 0`), `TABULAR` (any numeral column that must not jitter), `GOLD_GLOW` (the one-gold selection/hover/focus recipe — never hand-mix gold alphas), `TOUCH_TARGET`, `ICON_SIZE`, `PRESS_SCALE`, `DISABLED_STYLE`. Dynamic playstyle accents compose via `accentRgba` (playstyleUi.ts).

## Interaction conventions (#511)

- **Selection is border + glow (GOLD_GLOW), never `outline`**; the focus ring is never suppressed without a visible replacement (`GOLD_GLOW.focusRing`).
- **Disabled** = `DISABLED_STYLE`, everywhere. **Press** = `scale(${PRESS_SCALE})`.
- **EASING intent**: `snappy` hover/fast, `bounce` selection/press, `smooth` fades/progress.
- **DURATION** (2026-07-29 ruling) is the other half of the transition: `fast` 150 hover/press, `base` 200 default, `slow` 300 panels/expands, in ms. Three steps only — 250ms converges to `base`/`slow` on touch. `no-raw-duration` is bounded to the UI band (sub-second decimals, ≤3-digit ms), so decorative infinite loops and FLIP/handoff choreography never match: those stay literal behind a NAMED local const (`FLIP_DURATION`, `*_MS`), never forced onto the scale.
- **Reduced motion**: one source — `shared/utils/prefersReducedMotion` (fn for trigger-time, hook for render gating). No new hand-rolled `matchMedia` checks; new infinite animations MUST have a class in index.css's reduced-motion block. `useBoop` is already guarded.
- **Loading states**: skeleton for layout-known surfaces (one app-level `SkeletonTheme` in AppLayout — never add local wrappers), text for admin/unknown shapes, spinner only for the SW toast.
- **`surfaceHover` is overloaded** (six jobs); do not add new ones — aliases are deferred to a future ruling.

## Related

- **`no-raw-spacing` is `'off'`.** While it is off, spacing has **zero** enforcement,
  including on new code: see [[reference_disabled_lint_rule_is_invisible]]. **#548**
  converts the quoted shorthands the rule structurally cannot read, then **#549**
  seeds a ledger and flips it to `'error'`. That order is load-bearing, because
  seeding first would force new ledger entries, which shrink-only forbids.
  Measured 2026-07-31: 314 violations across 134 files the rule can see, plus 86
  off-scale values hidden inside quoted shorthands (`padding: '0 14px'`) that it
  cannot. This line previously said "#508 Step 6; #511 owns the sweep": both were
  closed, and #511's scope was the micro-pattern consts, never a spacing sweep. That
  misdirection cost real time. Do not re-add a pointer without checking the issue is
  open and actually says so.
- Token declaration sites (`theme.ts`, `playstyleUi.ts`), `src/docs/` stories, tests, and the five SVG icon components are permanently exempt from the color rules.
- Import tokens through the barrel (`shared/constants`), never the theme files directly (`no-restricted-imports` enforces).
