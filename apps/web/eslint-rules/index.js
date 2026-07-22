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

// Value predicates, named so the rule definitions read as data.
const isStringLiteral = (v) => v.type === 'Literal' && typeof v.value === 'string';
const isNumberLiteral = (v) => v.type === 'Literal' && typeof v.value === 'number';
const isRawFontFamily = (v) => isStringLiteral(v) && v.value !== 'inherit';
const isRawFontSize = (v) => isNumberLiteral(v) || (isStringLiteral(v) && /^\d+(px)?$/.test(v.value));
const isAppLayerZIndex = (v) => isNumberLiteral(v) && v.value >= 50;
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

/** Transitions use the EASING spring tokens, not keyword easings. */
const EASING_PROPS = new Set(['transition', 'animation', 'transitionTimingFunction', 'animationTimingFunction']);
const EASE_RE = /\b(ease(?:-in|-out|-in-out)?|cubic-bezier\s*\()/;
const noRawEasing = {
  meta: {
    type: 'problem',
    docs: {description: 'Use EASING.snappy/bounce/smooth instead of ease keywords or raw cubic-bezier'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, TEST_EXEMPT) || isKnownOffender(context, 'no-raw-easing')) return {};
    return {
      Property(node) {
        if (!EASING_PROPS.has(keyName(node))) return;
        forEachStringChunk(node.value, (chunk, text) => {
          if (EASE_RE.test(text)) {
            context.report({
              node: chunk,
              message:
                'Keyword/bezier easing. Use the spring tokens: EASING.snappy (hover/fast), EASING.bounce (selection/press), EASING.smooth (fades/progress) (#508).',
            });
          }
        });
      },
    };
  },
};

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

export const inkweave = {
  meta: {name: 'eslint-plugin-inkweave', version: '1.0.0'},
  rules: {
    'no-raw-hex-colors': noRawHexColors,
    'no-raw-rgba': noRawRgba,
    'no-literal-font-family': noLiteralFontFamily,
    'no-raw-font-size': noRawFontSize,
    'no-raw-radius': noRawRadius,
    'no-raw-z-index': noRawZIndex,
    'no-raw-easing': noRawEasing,
    'no-backdrop-filter': noBackdropFilter,
    'no-raw-spacing': noRawSpacing,
    'no-adhoc-buttons': noAdhocButtons,
    'no-unshelled-dialogs': noUnshelledDialogs,
  },
};
