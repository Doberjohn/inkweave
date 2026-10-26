// The values a token scale holds, typed into a stylesheet: radii, font sizes, shadows and
// durations (RADIUS, FONT_SIZES, SHADOWS, DURATION). No lint rule reads .css, so
// check-design-tokens.mjs freezes this count per .css file, as #546 froze the raw colours and
// easings there. It counts one per declaration that types one in, sorted as the weekly design
// system check sorts them, so the two agree on what a value is.

const RADIUS_PROPERTIES = [
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-start-start-radius',
  'border-start-end-radius',
  'border-end-start-radius',
  'border-end-end-radius',
];
const MOTION_PROPERTIES = ['transition', 'animation', 'transition-duration', 'animation-duration', 'transition-delay', 'animation-delay'];
/** What a property's value is read for. */
const SCALE_OF = new Map([
  ...RADIUS_PROPERTIES.map((property) => [property, 'length']),
  ['font-size', 'length'],
  ['box-shadow', 'shadow'],
  ['text-shadow', 'shadow'],
  ...MOTION_PROPERTIES.map((property) => [property, 'duration']),
]);

const DECLARATION = /(^|[{;\s])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]*?)\s*(?=[;}]|$)/g;
const NUMBER = /(^|[\s,(/+*:-])(-?)(\d*\.?\d+)([a-z%]*)/gi;
const LENGTH_UNITS = new Set(['', 'px', 'rem', 'em']);
const SHADOW_UNITS = new Set(['', 'px']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\([^)]*\)/gi;
const TIME = /(^|[\s,(])\d*\.?\d+m?s\b/i;

/** The units of a value's non-zero numbers, leaving out url()s and the digits in a name (`--glow-2`). */
function numberUnits(value) {
  const text = value.replace(/url\([^)]*\)/gi, ' ');
  const units = [];
  for (const m of text.matchAll(NUMBER)) {
    const named = m[1] === '-' && /[a-z]/i.test(text[m.index - 1] ?? '');
    if (!named && Number(m[2] + m[3]) !== 0) units.push(m[4].toLowerCase());
  }
  return units;
}

/**
 * Whether a declaration's value types in a scale's value. A decorative infinite animation keeps
 * its literal timings, as DURATION's scope in theme.ts says, so it never counts.
 */
function typesScaleValue(scale, value) {
  if (scale === 'duration') return TIME.test(value) && !/\binfinite\b/i.test(value);
  const units = scale === 'shadow' ? SHADOW_UNITS : LENGTH_UNITS;
  return numberUnits(scale === 'shadow' ? value.replace(COLOR, ' ') : value).some((unit) => units.has(unit));
}

/** How many declarations in a stylesheet type in a radius, font size, shadow or duration. */
export function countScaleValues(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  let count = 0;
  for (const [, , property, value] of text.matchAll(DECLARATION)) {
    const scale = SCALE_OF.get(property.toLowerCase());
    if (scale && typesScaleValue(scale, value)) count += 1;
  }
  return count;
}
