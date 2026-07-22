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
// plugin objects natively.
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

function isColorExempt(context) {
  const name = relName(context);
  return COLOR_EXEMPT.some((re) => re.test(name));
}

/** Walk string-ish nodes: string Literals and template quasis. */
function forEachStringChunk(node, cb) {
  if (node.type === 'Literal' && typeof node.value === 'string') cb(node, node.value);
  if (node.type === 'TemplateLiteral') {
    for (const quasi of node.quasis) cb(quasi, quasi.value.cooked ?? '');
  }
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGBA_RE = /\brgba?\s*\(/;
const EASE_RE = /\b(ease(?:-in|-out|-in-out)?|cubic-bezier\s*\()/;

/** Property key name for both identifier and string keys. */
function keyName(prop) {
  if (prop.key?.type === 'Identifier') return prop.key.name;
  if (prop.key?.type === 'Literal') return String(prop.key.value);
  return undefined;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Ban raw hex color literals; COLORS/INK_COLORS/TIER_COLORS carry the palette. */
const noRawHexColors = {
  meta: {
    type: 'problem',
    docs: {description: 'Use COLORS/INK_COLORS/TIER_COLORS tokens instead of raw hex colors'},
    schema: [],
  },
  create(context) {
    if (isColorExempt(context) || isKnownOffender(context, 'no-raw-hex-colors')) return {};
    const check = (node, text) => {
      if (HEX_RE.test(text)) {
        context.report({
          node,
          message:
            'Raw hex color. Use a token (COLORS.*, INK_COLORS.*, TIER_COLORS.*) — if no token fits, that is a design-system gap: raise it, do not inline (#508).',
        });
      }
    };
    return {
      Literal: (node) => forEachStringChunk(node, check),
      TemplateLiteral: (node) => forEachStringChunk(node, check),
    };
  },
};

/** Ban raw rgba()/rgb() strings; hexRgba/blackRgba/whiteRgba/COLORS.scrim cover alpha needs. */
const noRawRgba = {
  meta: {
    type: 'problem',
    docs: {description: 'Use hexRgba(COLORS.x, a) / blackRgba(a) / whiteRgba(a) / COLORS.scrim instead of raw rgba()'},
    schema: [],
  },
  create(context) {
    if (isColorExempt(context) || isKnownOffender(context, 'no-raw-rgba')) return {};
    const check = (node, text) => {
      if (RGBA_RE.test(text)) {
        context.report({
          node,
          message:
            'Raw rgba()/rgb(). Compose from tokens: hexRgba(COLORS.x, a) for tinted alpha, blackRgba/whiteRgba for neutrals, COLORS.scrim/scrimHeavy for dialog scrims (#508).',
        });
      }
    };
    return {
      Literal: (node) => forEachStringChunk(node, check),
      TemplateLiteral: (node) => forEachStringChunk(node, check),
    };
  },
};

/** fontFamily must come from FONTS.* ('inherit' is a legitimate CSS reset). */
const noLiteralFontFamily = {
  meta: {
    type: 'problem',
    docs: {description: 'Use FONTS.body / FONTS.hero instead of font-family string literals'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-literal-font-family')) return {};
    return {
      Property(node) {
        if (keyName(node) !== 'fontFamily') return;
        if (node.value.type === 'Literal' && typeof node.value.value === 'string' && node.value.value !== 'inherit') {
          context.report({
            node: node.value,
            message: "Literal font-family. Use FONTS.body or FONTS.hero ('inherit' is allowed as a UA reset) (#508).",
          });
        }
      },
    };
  },
};

/** fontSize numbers come from FONT_SIZES (incl. the display tier). */
const noRawFontSize = {
  meta: {
    type: 'problem',
    docs: {description: 'Use FONT_SIZES.* instead of numeric font sizes'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-raw-font-size') || /\.test\.(ts|tsx)$/.test(relName(context))) return {};
    return {
      Property(node) {
        if (keyName(node) !== 'fontSize') return;
        const v = node.value;
        const isRawNumber = v.type === 'Literal' && typeof v.value === 'number';
        const isRawPxString = v.type === 'Literal' && typeof v.value === 'string' && /^\d+(px)?$/.test(v.value);
        if (isRawNumber || isRawPxString) {
          context.report({
            node: v,
            message: 'Raw font size. Use FONT_SIZES.* (xs..xxxl, displaySm/Md/Lg for hero sizes) (#508).',
          });
        }
      },
    };
  },
};

/** borderRadius numbers come from RADIUS (incl. pill); '50%' circles are fine. */
const noRawRadius = {
  meta: {
    type: 'problem',
    docs: {description: 'Use RADIUS.* (incl. RADIUS.pill) instead of numeric border radii'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-raw-radius') || /\.test\.(ts|tsx)$/.test(relName(context))) return {};
    return {
      Property(node) {
        if (keyName(node) !== 'borderRadius') return;
        const v = node.value;
        if (v.type === 'Literal' && typeof v.value === 'number') {
          context.report({
            node: v,
            message: "Raw border radius. Use RADIUS.* (pill: 999 exists; '50%' strings are fine for circles) (#508).",
          });
        }
      },
    };
  },
};

/** App-layer z-indexes come from Z_INDEX; local stacking (< 50) stays free. */
const noRawZIndex = {
  meta: {
    type: 'problem',
    docs: {description: 'Use Z_INDEX.* for app layers (values >= 50); local stacking below 50 is fine'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-raw-z-index')) return {};
    return {
      Property(node) {
        if (keyName(node) !== 'zIndex') return;
        const v = node.value;
        if (v.type === 'Literal' && typeof v.value === 'number' && v.value >= 50) {
          context.report({
            node: v,
            message: 'Raw app-layer z-index. Use Z_INDEX.* (toast: 1200 and swUpdate: 1300 exist since #507) (#508).',
          });
        }
      },
    };
  },
};

/** Transitions use the EASING spring tokens, not keyword easings. */
const noRawEasing = {
  meta: {
    type: 'problem',
    docs: {description: 'Use EASING.snappy/bounce/smooth instead of ease keywords or raw cubic-bezier'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-raw-easing') || /\.test\.(ts|tsx)$/.test(relName(context))) return {};
    const PROPS = new Set(['transition', 'animation', 'transitionTimingFunction', 'animationTimingFunction']);
    return {
      Property(node) {
        if (!PROPS.has(keyName(node))) return;
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
const noBackdropFilter = {
  meta: {
    type: 'problem',
    docs: {description: 'Never use backdrop-filter (WebKit E2E repaint trap); use a solid deepened scrim'},
    schema: [],
  },
  create(context) {
    const report = (node) =>
      context.report({
        node,
        message:
          'backdrop-filter hangs WebKit E2E (#444/#445). Use a solid scrim instead: COLORS.scrim / COLORS.scrimHeavy.',
      });
    return {
      Property(node) {
        const k = keyName(node);
        if (k === 'backdropFilter' || k === 'WebkitBackdropFilter') report(node);
      },
      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes('backdrop-filter')) report(node);
      },
    };
  },
};

/**
 * Spacing rule — implemented but registered 'off' in eslint.config.js.
 * ENABLE CONDITION (#508 Step 6): after the Wave-0 convergence sweep reduces
 * the ~429 raw non-zero spacing literals; enabling earlier drowns the signal.
 */
const noRawSpacing = {
  meta: {
    type: 'problem',
    docs: {description: 'Use SPACING.* for padding/margin/gap (0 is always fine)'},
    schema: [],
  },
  create(context) {
    if (isKnownOffender(context, 'no-raw-spacing') || /\.test\.(ts|tsx)$/.test(relName(context))) return {};
    const PROPS = new Set(['padding', 'margin', 'gap', 'rowGap', 'columnGap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft']);
    return {
      Property(node) {
        if (!PROPS.has(keyName(node))) return;
        const v = node.value;
        if (v.type === 'Literal' && typeof v.value === 'number' && v.value !== 0) {
          context.report({node: v, message: 'Raw spacing. Use SPACING.* (xxs..xxxl; 0 is always allowed) (#508).'});
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
    'no-raw-radius': noRawRadius,
    'no-raw-z-index': noRawZIndex,
    'no-raw-easing': noRawEasing,
    'no-backdrop-filter': noBackdropFilter,
    'no-raw-spacing': noRawSpacing,
  },
};
