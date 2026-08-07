// The `inkweave` inline ESLint plugin (#508, Design System Enforcement Wave 1).
//
// Design-token discipline as AST rules: new code cannot ship raw hex colors,
// rgba() strings, font names, sizes, radii, z-indexes, easing keywords, or
// backdrop-filter — each error message points at the token that replaces the
// literal. Existing violations are grandfathered per-file in
// ./known-offenders.js (the ledger ONLY SHRINKS; remove a file when it comes
// clean). The sibling value-grep gate (scripts/check-design-tokens.mjs) covers
// what the AST cannot see: cssText strings, quoted shorthands, and CSS files.
//
// House precedent: the no-restricted-syntax useMemo/useCallback ban in
// eslint.config.js (#291). Zero dependencies — flat config supports inline
// plugin objects natively. The rules are built from two factories (string-scan
// and property-value) so each rule is data, not a bespoke visitor.
import {KNOWN_OFFENDERS} from './known-offenders.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Repo-relative, forward-slash filename for stable matching on Windows. */
function relName(context) {
  return context.filename.replace(/\\/g, '/').replace(/^.*?apps\/web\//, 'apps/web/');
}

/** True when the file is grandfathered for the given rule. */
function isKnownOffender(context, rule) {
  const list = KNOWN_OFFENDERS[rule] ?? [];
  const name = relName(context);
  return list.some((entry) => name.endsWith(entry));
}

/**
 * Permanently exempt files for the color rules: token declaration sites, the
 * token documentation stories (they must show literals), unit tests (assertion
 * pins), and the SVG icon components (vector art, not themed UI).
 */
const COLOR_EXEMPT = [
  /shared\/constants\/theme\.ts$/,
  /shared\/constants\/playstyleUi\.ts$/,
  /src\/docs\//,
  /\.test\.(ts|tsx)$/,
  /shared\/components\/(CostIcon|FilterIcon|SearchIcon|InkIcon|InkwellIcon)\.tsx$/,
];

const TEST_EXEMPT = [/\.test\.(ts|tsx)$/];

function isExempt(context, exemptPatterns) {
  const name = relName(context);
  return exemptPatterns.some((re) => re.test(name));
}

/** Walk string-ish nodes: string Literals and template quasis. */
function forEachStringChunk(node, cb) {
  if (node.type === 'Literal' && typeof node.value === 'string') cb(node, node.value);
  if (node.type === 'TemplateLiteral') {
    for (const quasi of node.quasis) cb(quasi, quasi.value.cooked ?? '');
  }
}

/** Member name for both `X.y` and the computed `X['y']`; undefined otherwise. */
function memberName(node) {
  if (node.computed) return node.property.type === 'Literal' ? String(node.property.value) : undefined;
  return node.property.type === 'Identifier' ? node.property.name : undefined;
}

/** Property key name for both identifier and string keys. */
function keyName(prop) {
  if (prop.key?.type === 'Identifier') return prop.key.name;
  if (prop.key?.type === 'Literal') return String(prop.key.value);
  return undefined;
}

// ---------------------------------------------------------------------------
// Rule factories — a rule is (scan target) + (predicate) + (message).
// ---------------------------------------------------------------------------

/** A rule that flags any string literal/template chunk matching `re`. */
function makeStringScanRule({name, description, re, message, exempt = []}) {
  return {
    meta: {type: 'problem', docs: {description}, schema: []},
    create(context) {
      if (isExempt(context, exempt) || isKnownOffender(context, name)) return {};
      const check = (node, text) => {
        if (re.test(text)) context.report({node, message});
      };
      return {
        Literal: (node) => forEachStringChunk(node, check),
        TemplateLiteral: (node) => forEachStringChunk(node, check),
      };
    },
  };
}

/** A rule that flags style-object properties whose value fails `valueTest`. */
function makePropertyRule({name, description, props, valueTest, message, exempt = []}) {
  const propSet = new Set(props);
  return {
    meta: {type: 'problem', docs: {description}, schema: []},
    create(context) {
      if (isExempt(context, exempt) || isKnownOffender(context, name)) return {};
      return {
        Property(node) {
          if (!propSet.has(keyName(node))) return;
          if (valueTest(node.value)) context.report({node: node.value, message});
        },
      };
    },
  };
}

/**
 * A rule that flags reads of `Object.prop` for a named set of props. The third
 * shape the plugin needs: a deprecated TOKEN is neither a string literal nor a
 * style-property value, so neither existing factory can see it.
 */
function makeMemberRule({name, description, object, properties, message, exempt = []}) {
  const propSet = new Set(properties);
  return {
    meta: {type: 'problem', docs: {description}, schema: []},
    create(context) {
      if (isExempt(context, exempt) || isKnownOffender(context, name)) return {};
      return {
        MemberExpression(node) {
          if (node.object.type !== 'Identifier' || node.object.name !== object) return;
          if (propSet.has(memberName(node))) context.report({node, message});
        },
      };
    },
  };
}

// Value predicates, named so the rule definitions read as data.
const isStringLiteral = (v) => v.type === 'Literal' && typeof v.value === 'string';
const isNumberLiteral = (v) => v.type === 'Literal' && typeof v.value === 'number';
const isRawFontFamily = (v) => isStringLiteral(v) && v.value !== 'inherit';
const isRawFontSize = (v) => isNumberLiteral(v) || (isStringLiteral(v) && /^\d+(px)?$/.test(v.value));
const isAppLayerZIndex = (v) => isNumberLiteral(v) && v.value >= 50;
/** Only these four have a self-hosted woff2; see the @font-face block in index.css. */
const LOADED_FONT_WEIGHTS = new Set([400, 500, 600, 700]);
const isUnloadedWeight = (v) => isNumberLiteral(v) && !LOADED_FONT_WEIGHTS.has(v.value);
const isNonZeroNumber = (v) => isNumberLiteral(v) && v.value !== 0;

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

const noRawHexColors = makeStringScanRule({
  name: 'no-raw-hex-colors',
  description: 'Use COLORS/INK_COLORS/TIER_COLORS tokens instead of raw hex colors',
  re: /#[0-9a-fA-F]{3,8}\b/,
  exempt: COLOR_EXEMPT,
  message:
    'Raw hex color. Use a token (COLORS.*, INK_COLORS.*, TIER_COLORS.*) — if no token fits, that is a design-system gap: raise it, do not inline (#508).',
});

const noRawRgba = makeStringScanRule({
  name: 'no-raw-rgba',
  description: 'Use hexRgba(COLORS.x, a) / blackRgba(a) / whiteRgba(a) / COLORS.scrim instead of raw rgba()',
  re: /\brgba?\s*\(/,
  exempt: COLOR_EXEMPT,
  message:
    'Raw rgba()/rgb(). Compose from tokens: hexRgba(COLORS.x, a) for tinted alpha, blackRgba/whiteRgba for neutrals, COLORS.scrim/scrimHeavy for dialog scrims (#508).',
});

const noLiteralFontFamily = makePropertyRule({
  name: 'no-literal-font-family',
  description: 'Use FONTS.body / FONTS.hero instead of font-family string literals',
  props: ['fontFamily'],
  valueTest: isRawFontFamily,
  message: "Literal font-family. Use FONTS.body or FONTS.hero ('inherit' is allowed as a UA reset) (#508).",
});

const noRawFontSize = makePropertyRule({
  name: 'no-raw-font-size',
  description: 'Use FONT_SIZES.* instead of numeric font sizes',
  props: ['fontSize'],
  valueTest: isRawFontSize,
  exempt: TEST_EXEMPT,
  message: 'Raw font size. Use FONT_SIZES.* (xs..xxxl, displaySm/Md/Lg for hero sizes) (#508).',
});

const noRawRadius = makePropertyRule({
  name: 'no-raw-radius',
  description: 'Use RADIUS.* (incl. RADIUS.pill) instead of numeric border radii',
  props: ['borderRadius'],
  valueTest: isNumberLiteral,
  exempt: TEST_EXEMPT,
  message: "Raw border radius. Use RADIUS.* (pill: 999 exists; '50%' strings are fine for circles) (#508).",
});

const noRawZIndex = makePropertyRule({
  name: 'no-raw-z-index',
  description: 'Use Z_INDEX.* for app layers (values >= 50); local stacking below 50 is fine',
  props: ['zIndex'],
  valueTest: isAppLayerZIndex,
  message: 'Raw app-layer z-index. Use Z_INDEX.* (toast: 1200 and swUpdate: 1300 exist since #507) (#508).',
});

/**
 * Spacing rule — implemented but registered 'off' in eslint.config.js.
 * ENABLE CONDITION (#508 Step 6): after the Wave-0 convergence sweep reduces
 * the ~429 raw non-zero spacing literals; enabling earlier drowns the signal.
 */
const noRawSpacing = makePropertyRule({
  name: 'no-raw-spacing',
  description: 'Use SPACING.* for padding/margin/gap (0 is always fine)',
  props: [
    'padding', 'margin', 'gap', 'rowGap', 'columnGap',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  ],
  valueTest: isNonZeroNumber,
  exempt: TEST_EXEMPT,
  message: 'Raw spacing. Use SPACING.* (xxs..xxxl; 0 is always allowed) (#508).',
});

/**
 * A weight with no loaded face does not render — it silently falls back.
 * `font-synthesis: none` on :root (index.css) forbids faking one, and only
 * 400/500/600/700 ship a woff2. Measured 2026-07-29: `fontWeight: 800` and 700
 * both rasterize to 738.50px, so 7 declarations of 800 were doing nothing.
 *
 * This is a RENDERING rule, not a token rule: the values are dictated by which
 * files exist in public/fonts. Adding a weight to the set means adding both a
 * woff2 and an @font-face block. Ships with an EMPTY ledger, since the 18 dead
 * declarations were corrected in the same commit that added it.
 *
 * Covers the JS object form only. The CSS-string form (`font-weight:800` inside
 * a cssText template) is not visited — it is rare, and would need a value-gate
 * tripwire rather than an AST rule.
 */
const noUnloadedFontWeight = makePropertyRule({
  name: 'no-unloaded-font-weight',
  description: 'Only 400/500/600/700 have a self-hosted face; font-synthesis is none, so others silently fall back',
  props: ['fontWeight'],
  valueTest: isUnloadedWeight,
  exempt: TEST_EXEMPT,
  message:
    'No font face is loaded for this weight, and font-synthesis is none — it will silently render as the nearest loaded weight. Use 400/500/600/700, or add the woff2 + @font-face first. Marcellus (FONTS.hero) is 400-ONLY.',
});

/**
 * The one-gold ruling (2026-07-22): COLORS.primary (#ffb900) is THE brand gold.
 * primary500/600/700 are the legacy accent, grandfathered only — and 500 and 600
 * are the SAME hex (#d4af37), a duplicate nobody had a mechanism to notice.
 *
 * This needs its own rule shape because BOTH existing mechanisms are blind to it
 * by construction: no-raw-hex-colors scans string literals and a MemberExpression
 * is not one, while the value-grep gate greps hexes parsed out of theme.ts and a
 * token reference carries no hex. The ruling was prose-only until now, and it was
 * losing ground — a post-ruling commit net-added a fresh reference.
 *
 * primary100/200 are gold-tinted dark BACKGROUNDS, not accents, and stay legal.
 */
const noLegacyGold = makeMemberRule({
  name: 'no-legacy-gold',
  description: 'Use COLORS.primary (the one brand gold); primary500/600/700 are the grandfathered legacy accent',
  object: 'COLORS',
  properties: ['primary500', 'primary600', 'primary700'],
  exempt: COLOR_EXEMPT,
  message:
    'Legacy gold. COLORS.primary (#ffb900) is the one brand gold — build glows/rings from SHADOWS.glowSm/Md/Lg and GOLD_GLOW.*, not primary500/600/700 (one-gold ruling, 2026-07-22).',
});

/**
 * Transitions use the EASING spring tokens, not keyword easings.
 *
 * SCANS STRINGS rather than style properties. The original property-shaped
 * version caught roughly one violation in four: given the identical value,
 * `{transition: 'opacity 200ms ease-out'}` reported, while the ternary
 * `{transition: on ? '…' : 'none'}`, a hoisted `const EASE = '…'`, and
 * `el.style.transition = '…'` all passed silently — and the ternary is this
 * repo's idiomatic conditional-animation form. A string scan sees all four
 * because it ignores syntactic position, and it reaches injected cssText
 * template literals for free.
 *
 * The duration guard is needed ONLY for the bare `ease` keyword, which is also
 * an English word ("ease the transition"); `cubic-bezier(` and the hyphenated
 * forms are unambiguous CSS on their own.
 */
const noRawEasing = makeStringScanRule({
  name: 'no-raw-easing',
  description: 'Use EASING.snappy/bounce/smooth instead of ease keywords or raw cubic-bezier',
  re: /cubic-bezier\s*\(|\b(?:ease-in-out|ease-out|ease-in)\b|\d\s*m?s\b[^;]*\bease\b/,
  exempt: TEST_EXEMPT,
  message:
    'Keyword/bezier easing. Use the spring tokens: EASING.snappy (hover/fast), EASING.bounce (selection/press), EASING.smooth (fades/progress) (#508).',
});

/**
 * The other half of every transition (2026-07-29 ruling). EASING guarded the
 * curve while the duration in front of it went untokenized: 18 distinct values
 * across 48 files, three of the top four spelled BOTH ways (`0.25s` and `250ms`).
 *
 * BOUNDED TO THE UI-TRANSITION BAND by the pattern itself: sub-second decimals
 * (`0.2s`) and at most three digits of ms (`200ms`). Anything >= 1s is a
 * decorative infinite loop (`reveal-floatY 4s`, `idv-shimmer 2.5s`) or a
 * narrative choreography beat (`1000ms`), which the fast/base/slow scale must
 * NOT swallow — so they never match, rather than sitting in a ledger that would
 * wrongly promise convergence. A `${FLIP_DURATION}ms` template is likewise
 * invisible: the number lives in an expression, and a named const is the goal.
 *
 * Its OWN ledger, not no-raw-easing's: every file ledgered for easing also
 * carries raw durations, so sharing a key would make this rule dead on arrival
 * in exactly the 23 files that need it most.
 */
const noRawDuration = makeStringScanRule({
  name: 'no-raw-duration',
  description: 'Use DURATION.fast/base/slow for transition and animation timings',
  re: /(?:^|[\s,(:])(?:0?\.\d+s|\d{1,3}ms)(?=[\s,)]|$)/,
  exempt: TEST_EXEMPT,
  message:
    'Raw transition duration. Use DURATION.fast (150, hover/press), DURATION.base (200, the default) or DURATION.slow (300, panels/expands) — decorative loops and FLIP choreography stay literal (2026-07-29 ruling).',
});

/** backdrop-filter is banned outright: WebKit continuous-repaint E2E trap (#444/#445). */
const BACKDROP_MESSAGE =
  'backdrop-filter hangs WebKit E2E (#444/#445). Use a solid scrim instead: COLORS.scrim / COLORS.scrimHeavy.';
const noBackdropFilter = {
  meta: {
    type: 'problem',
    docs: {description: 'Never use backdrop-filter (WebKit E2E repaint trap); use a solid deepened scrim'},
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        const k = keyName(node);
        if (k === 'backdropFilter' || k === 'WebkitBackdropFilter') context.report({node, message: BACKDROP_MESSAGE});
      },
      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes('backdrop-filter')) {
          context.report({node, message: BACKDROP_MESSAGE});
        }
      },
    };
  },
};

/**
 * The blessed button menu is closed (#509): a raw `<button style={…}>` in
 * feature code is an ad-hoc recipe the kit already covers. The kit's own
 * internals (shared/components/**) and the domain families below are the only
 * legitimate styled-button authors.
 */
const ADHOC_BUTTON_EXEMPT = [
  /src[\\/]shared[\\/]components[\\/]/, // the kit itself
  /QuantityStepper\.tsx$/, // domain stepper family
  /OptionPicker\.tsx$/, // vote picker family (CarriesPicker adapts it)
  /ScorePicker\.tsx$/, // vote score row
  /QuickVoteControl\.tsx$/, // vote control family
  /RoleTileRow\.tsx$/, // tile-toggle family
  /CardTile\.tsx$/, // card-grid tile family
  /CardSlot\.tsx$/, // reveals tile family
  /InkTrackerTile\.tsx$/, // reveals ink-selection tile family (#511)
  /HealthGrid\.tsx$/, // deck health-dimension ring toggles (#472)
  /HealthSummary\.tsx$/, // deck health cell — the whole card is the button (#472)
  /ScoreMathModal\.tsx$/, // deck score-breakdown disclosure rows (accordion, #472)
  /DeckPanel\.tsx$/, // DeckNameButton — the whole name+pencil row is the click-to-edit rename affordance (#472)
  /\.stories\.tsx$/,
  /\.test\.(ts|tsx)$/,
];
const ADHOC_BUTTON_MESSAGE =
  'Ad-hoc styled <button>. Use the kit: CtaButton (filled/ghost/neutral/pill), LinkButton, TabList, IconButton, FiltersButton, Chip — or extend a kit component (#509)';
const noAdhocButtons = {
  meta: {
    type: 'problem',
    docs: {description: 'Buttons come from the #509 kit; no hand-styled <button> in feature code'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, ADHOC_BUTTON_EXEMPT) || isKnownOffender(context, 'no-adhoc-buttons')) return {};
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'button') return;
        const styled = node.attributes.some(
          (a) => a.type === 'JSXAttribute' && a.name.name === 'style',
        );
        if (styled) context.report({node, message: ADHOC_BUTTON_MESSAGE});
      },
    };
  },
};

/**
 * The overlay contract (#510): a surface claiming aria-modal must get its
 * behavior from the house machinery — DialogShell / BottomSheet (which wire
 * the hook trio) or useDialogFocus directly. FilterDialog is the documented
 * Radix exception (.claude/rules/overlays.md).
 */
const ARIA_MODAL_EXEMPT = [
  /src[\\/]shared[\\/]components[\\/](DialogShell|BottomSheet)\.tsx$/,
  /FilterDialog\.tsx$/, // Radix Dialog supplies trap/lock/Escape — the one sanctioned alternative
  /\.stories\.tsx$/,
  /\.test\.(ts|tsx)$/,
];
const UNSHELLED_MESSAGE =
  'aria-modal without the overlay contract. Render through DialogShell / BottomSheet, or wire useDialogFocus + useScrollLock + useTransitionPresence directly (#510, .claude/rules/overlays.md)';
const noUnshelledDialogs = {
  meta: {
    type: 'problem',
    docs: {description: 'aria-modal surfaces must use DialogShell/BottomSheet or the useDialogFocus trio'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, ARIA_MODAL_EXEMPT) || isKnownOffender(context, 'no-unshelled-dialogs')) return {};
    let sanctioned = false;
    let firstAriaModal = null;
    return {
      ImportDeclaration(node) {
        if (/DialogShell|BottomSheet|useDialogFocus/.test(context.sourceCode.getText(node))) sanctioned = true;
      },
      JSXAttribute(node) {
        if (node.name.name === 'aria-modal' && !firstAriaModal) firstAriaModal = node;
      },
      'Program:exit'() {
        if (firstAriaModal && !sanctioned) context.report({node: firstAriaModal, message: UNSHELLED_MESSAGE});
      },
    };
  },
};

/**
 * Back navigation, one shape (#473 follow-up, owner ruling 2026-08-07).
 *
 * A census found ELEVEN back affordances in five shapes, with the shared BackLink
 * used at three of them — including one file that rendered the same destination as a
 * BackLink twice and a CtaButton once. The component existed the whole time; what did
 * not exist was anything stopping the next person from hand-rolling another.
 *
 * Two exemption families, both deliberate:
 *
 *   TERMINAL CTAs. "Back to Home" on a finished vote and "Back to decks" on a failed
 *   sign-in are the only action left on a dead-end screen, so they are primary buttons
 *   that happen to say back. Converting them would end those screens on a muted grey
 *   link. Named here rather than left to judgement.
 *
 *   BREADCRUMBS. `Playstyles / Lore Denial` answers "where am I", not "how do I
 *   leave", and Breadcrumb is its own component. It never matches this rule's text
 *   pattern, so it needs no exemption — noted so nobody adds one.
 */
const BACK_LINK_EXEMPT = [
  /src[\\/]shared[\\/]components[\\/](BackLink|Breadcrumb|CompactHeader)\.tsx$/,
  // Terminal screens: the one remaining action is a CTA, not a quiet return.
  /src[\\/]pages[\\/](VotePage|InDepthVotePage|AuthCallbackPage)\.tsx$/,
  // In-OVERLAY state reversal, not page navigation: CardOverviewModal's back control
  // steps between states inside one modal, and is cased to match that modal's own
  // header chrome. Converting it would make the header inconsistent with itself to
  // match pages it never sits on.
  /CardOverviewModal\.tsx$/,
  /\.stories\.tsx$/,
  /\.test\.(ts|tsx)$/,
];
/**
 * Matches the visible LABEL, not the destination.
 *
 * Two patterns, because the label reaches the AST two ways: as JSXText between tags,
 * and as a string Literal in a prop (label=, aria-label=). Three of the eleven census
 * sites were the second shape, so a JSXText-only rule would have missed them.
 *
 * Named predicates so each visitor below stays ONE condition, which is what keeps
 * create() under the complexity gate.
 */
const BACK_TEXT = /(^|>)\s*(\u2190|&larr;|Back to\b)/;
const BACK_STRING = /^\s*(\u2190\s*)?Back to\b/;
const isBackText = (node) => BACK_TEXT.test(node.value);
const isBackString = (node) => typeof node.value === 'string' && BACK_STRING.test(node.value);
const importsBackLink = (context, node) => /BackLink/.test(context.sourceCode.getText(node));
const BACK_LINK_MESSAGE =
  'Hand-rolled back navigation. Use <BackLink to=... /> or <BackLink onClick=... /> so every ' +
  'return looks the same (.claude/rules/navigation.md). On a terminal screen the last ' +
  'remaining action stays a CtaButton.';
const noAdhocBackLinks = {
  meta: {
    type: 'problem',
    docs: {description: 'back navigation must render through BackLink'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, BACK_LINK_EXEMPT) || isKnownOffender(context, 'no-adhoc-back-links')) return {};
    let sanctioned = false;
    let firstBackLabel = null;
    // First match only: a file with four hand-rolled back links has one problem, not
    // four, and four reports would bury the one that matters.
    const record = (node, matches) => {
      if (!firstBackLabel && matches(node)) firstBackLabel = node;
    };
    return {
      ImportDeclaration(node) {
        if (importsBackLink(context, node)) sanctioned = true;
      },
      JSXText(node) {
        record(node, isBackText);
      },
      Literal(node) {
        record(node, isBackString);
      },
      'Program:exit'() {
        if (firstBackLabel && !sanctioned) context.report({node: firstBackLabel, message: BACK_LINK_MESSAGE});
      },
    };
  },
};
export const inkweave = {
  meta: {name: 'eslint-plugin-inkweave', version: '1.0.0'},
  rules: {
    'no-raw-hex-colors': noRawHexColors,
    'no-raw-rgba': noRawRgba,
    'no-legacy-gold': noLegacyGold,
    'no-literal-font-family': noLiteralFontFamily,
    'no-raw-font-size': noRawFontSize,
    'no-unloaded-font-weight': noUnloadedFontWeight,
    'no-raw-radius': noRawRadius,
    'no-raw-z-index': noRawZIndex,
    'no-raw-easing': noRawEasing,
    'no-raw-duration': noRawDuration,
    'no-backdrop-filter': noBackdropFilter,
    'no-raw-spacing': noRawSpacing,
    'no-adhoc-buttons': noAdhocButtons,
    'no-unshelled-dialogs': noUnshelledDialogs,
    'no-adhoc-back-links': noAdhocBackLinks,
  },
};
