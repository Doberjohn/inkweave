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

/**
 * Stories and the token-showcase docs are fixtures: their padding is
 * scaffolding, not product (owner ruling, 2026-07-31). Mirrors the color rules,
 * which already exempt src/docs/. theme.ts is not exempt, unlike for the color
 * rules: its raw spacing goes in the ledger like any other file's (owner,
 * 2026-10-22).
 */
const SPACING_EXEMPT = [...TEST_EXEMPT, /\.stories\.tsx$/, /src\/docs\//];

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

/** The values a ternary can give: `a ? 8 : b ? 12 : 16` gives 8, 12 and 16; any other node is its own value. */
function ternaryLeaves(node) {
  if (node.type !== 'ConditionalExpression') return [node];
  return [...ternaryLeaves(node.consequent), ...ternaryLeaves(node.alternate)];
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

/**
 * A rule that flags style-object properties whose value fails `valueTest`.
 * `values` picks the nodes a property's value is checked as: by default the
 * value itself, or `ternaryLeaves` to check each branch of a ternary.
 */
function makePropertyRule({name, description, props, valueTest, message, exempt = [], values = (v) => [v]}) {
  const propSet = new Set(props);
  return {
    meta: {type: 'problem', docs: {description}, schema: []},
    create(context) {
      if (isExempt(context, exempt) || isKnownOffender(context, name)) return {};
      return {
        Property(node) {
          if (!propSet.has(keyName(node))) return;
          for (const value of values(node.value)) {
            if (valueTest(value)) context.report({node: value, message});
          }
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
/** `-14` is a unary minus around 14, so a negative margin is read through it. */
const isRawSpacing = (v) => isNonZeroNumber(v.type === 'UnaryExpression' && v.operator === '-' ? v.argument : v);

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

/** The weights with a self-hosted face (index.css): the body sans has four, the hero serif one. */
const LOADED_FONT_WEIGHTS = new Set([400, 500, 600, 700]);
const HERO_FONT_WEIGHT = 400;
const NAMED_WEIGHTS = {normal: 400, bold: 700};

/** A weight literal as a number: `700`, `'700'`, `'bold'`. Anything else (a variable, `'inherit'`) is unknown. */
function literalWeight(v) {
  if (isNumberLiteral(v)) return v.value;
  if (!isStringLiteral(v)) return undefined;
  return /^\d+$/.test(v.value) ? Number(v.value) : NAMED_WEIGHTS[v.value];
}

const isFontsHero = (v) => v.type === 'MemberExpression' && v.object.name === 'FONTS' && v.property.name === 'hero';

const UNLOADED_WEIGHT_MESSAGE =
  'No face is loaded for this weight, and font-synthesis is none, so it renders as the nearest loaded one. Use 400/500/600/700, or add the woff2 and @font-face first.';
const HERO_WEIGHT_MESSAGE =
  'The hero serif (FONTS.hero, Marcellus) ships 400 only and font-synthesis is none, so any other weight renders as 400. Set fontWeight: 400.';

/** Why weight `w` won't render as written, or undefined when it will (or isn't a literal). */
function weightProblem(w, hero) {
  if (w === undefined) return undefined;
  if (hero) return w === HERO_FONT_WEIGHT ? undefined : HERO_WEIGHT_MESSAGE;
  return LOADED_FONT_WEIGHTS.has(w) ? undefined : UNLOADED_WEIGHT_MESSAGE;
}

/** Every weight in one style object that has no face to render it, as `context.report` arguments. */
function unloadedWeights(node) {
  const props = node.properties.filter((p) => p.type === 'Property');
  const weight = props.find((p) => keyName(p) === 'fontWeight');
  if (!weight) return [];
  const hero = props.some((p) => keyName(p) === 'fontFamily' && isFontsHero(p.value));
  return ternaryLeaves(weight.value)
    .map((value) => ({node: value, message: weightProblem(literalWeight(value), hero)}))
    .filter((report) => report.message);
}

/**
 * A weight with no loaded face does not render: `font-synthesis: none` on :root
 * (index.css) forbids faking one, so the browser silently uses the nearest face
 * that exists. The body sans at 800 renders as its 700, and the hero serif at
 * 700 renders as its only face, 400. deck-builder measured both and fixed 18 such
 * declarations (45458e18, 2026-07-29). The values come from public/fonts, not
 * from taste: a new weight needs its woff2 and @font-face block first.
 *
 * It reads literal weights in a style object, both branches of a ternary, and
 * holds an object that names FONTS.hero to 400. Not seen: a weight in a cssText
 * string, a hero style reached through a spread (`{...DIALOG_TITLE, fontWeight:
 * 700}`), and an <h1>-<h6> that is bold by default, which is why hero headings
 * set 400 out loud.
 */
const noUnloadedFontWeight = {
  meta: {
    type: 'problem',
    docs: {description: 'Only weights with a self-hosted face render: 400-700 for the body sans, 400 for the hero serif'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, TEST_EXEMPT) || isKnownOffender(context, 'no-unloaded-font-weight')) return {};
    return {
      ObjectExpression(node) {
        for (const report of unloadedWeights(node)) context.report(report);
      },
    };
  },
};

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
 * Spacing, on since #549 with the files that predate it in the ledger. It reads
 * both branches of a ternary (`padding: isMobile ? 8 : 12`), where layouts fork
 * by breakpoint, negative values (`marginTop: -14`) and the logical properties.
 * A quoted shorthand ('8px 12px') is a string it cannot read; #548 converts those.
 */
const noRawSpacing = makePropertyRule({
  name: 'no-raw-spacing',
  description: 'Use SPACING.* for padding/margin/gap (0 is always fine)',
  props: [
    'padding', 'margin', 'gap', 'rowGap', 'columnGap',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingBlock', 'paddingBlockStart', 'paddingBlockEnd',
    'paddingInline', 'paddingInlineStart', 'paddingInlineEnd',
    'marginBlock', 'marginBlockStart', 'marginBlockEnd',
    'marginInline', 'marginInlineStart', 'marginInlineEnd',
  ],
  valueTest: isRawSpacing,
  values: ternaryLeaves,
  exempt: SPACING_EXEMPT,
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
  /SynergyMoreTile\.tsx$/, // card-grid tile family: a synergy group's "+N more" tile
  /CardSlot\.tsx$/, // reveals tile family
  /InkTrackerTile\.tsx$/, // reveals ink-selection tile family (#511)
  /SpotlightHero\.tsx$/, // reveals spotlight tile family (#835)
  /ComparisonCardTile\.tsx$/, // phone comparison card tile family (#835)
  /ScoreChevronsTab\.tsx$/, // phone comparison score tab family (#835)
  /VoteGroupTabs\.tsx$/, // in-depth vote group tab family (#835)
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
 * COLORS.textDim as text fails WCAG 1.4.3 on every surface (2.6:1 to 3.5:1). Allowed: the branch
 * of a `disabled` ternary (inactive controls are exempt) and a style on an aria-hidden element
 * (decoration). A helper function that returns textDim is not seen; keep those to disabled states.
 */
const TEXT_COLOR_PROPS = new Set(['color', 'WebkitTextFillColor']);
/** Expressions a colour value passes through on its way to its property: `a ? b : c`, `a || b`, `hexRgba(b, 0.8)`. */
const COLOR_VALUE_WRAPPERS = new Set([
  'ConditionalExpression',
  'LogicalExpression',
  'CallExpression',
  'TemplateLiteral',
  'TSAsExpression',
  'TSNonNullExpression',
]);
const DIM_TEXT_MESSAGE =
  'COLORS.textDim as text measures 2.6:1 to 3.5:1, under WCAG 1.4.3. Use COLORS.textMuted; textDim is for borders, strokes, disabled states and aria-hidden decoration.';
/** `COLORS.textDim`, or `COLORS['textDim']`: a computed key names the same token. */
const DIM_TEXT_SELECTOR = [
  'MemberExpression[object.name="COLORS"][property.name="textDim"]',
  'MemberExpression[object.name="COLORS"][property.value="textDim"]',
].join(', ');

/** A ternary test that names a disabled flag: `disabled`, `isDisabled`, `props.disabled`. */
function isDisabledFlag(test) {
  const id = test.type === 'MemberExpression' ? test.property : test;
  return id.type === 'Identifier' && /disabled/i.test(id.name);
}

/** True when `child` is the `<here>` of `disabled ? <here> : …`. */
function isDisabledBranch(parent, child) {
  return parent.type === 'ConditionalExpression' && parent.consequent === child && isDisabledFlag(parent.test);
}

/**
 * True when `node` is, or sits in the expression that is, the value of a `color` or
 * `WebkitTextFillColor` property, outside a disabled branch. `ancestors` runs outermost first.
 */
function isTextColorValue(node, ancestors) {
  let child = node;
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const parent = ancestors[i];
    if (parent.type === 'Property') return parent.value === child && TEXT_COLOR_PROPS.has(keyName(parent));
    if (isDisabledBranch(parent, child) || !COLOR_VALUE_WRAPPERS.has(parent.type)) return false;
    child = parent;
  }
  return false;
}

/** `aria-hidden`, `aria-hidden="true"` or `aria-hidden={true}`. */
function isAriaHiddenAttribute(attr) {
  if (attr.type !== 'JSXAttribute' || attr.name.name !== 'aria-hidden') return false;
  const value = attr.value?.type === 'JSXExpressionContainer' ? attr.value.expression : attr.value;
  return value === null || value.value === true || value.value === 'true';
}

/** True when the nearest JSX attribute holding the node is the `style` of an aria-hidden element. */
function isOnAriaHiddenElement(ancestors) {
  const attr = ancestors.findLast((a) => a.type === 'JSXAttribute');
  return attr?.name.name === 'style' && attr.parent.attributes.some(isAriaHiddenAttribute);
}

const noDimText = {
  meta: {
    type: 'problem',
    docs: {description: 'Keep COLORS.textDim off text: it fails WCAG 1.4.3 contrast'},
    schema: [],
  },
  create(context) {
    if (isExempt(context, COLOR_EXEMPT)) return {};
    return {
      [DIM_TEXT_SELECTOR](node) {
        const ancestors = context.sourceCode.getAncestors(node);
        if (isTextColorValue(node, ancestors) && !isOnAriaHiddenElement(ancestors)) {
          context.report({node, message: DIM_TEXT_MESSAGE});
        }
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
    'no-unloaded-font-weight': noUnloadedFontWeight,
    'no-raw-radius': noRawRadius,
    'no-raw-z-index': noRawZIndex,
    'no-raw-easing': noRawEasing,
    'no-backdrop-filter': noBackdropFilter,
    'no-raw-spacing': noRawSpacing,
    'no-adhoc-buttons': noAdhocButtons,
    'no-unshelled-dialogs': noUnshelledDialogs,
    'no-dim-text': noDimText,
  },
};
