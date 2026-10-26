// The values a token scale holds, typed into a stylesheet: radii, font sizes, shadows and
// durations (RADIUS, FONT_SIZES, SHADOWS, DURATION). No lint rule reads .css, so
// check-design-tokens.mjs freezes this count per .css file, as #546 froze the raw colours and
// easings there (#1013). It counts one per declaration that types one in. The weekly design
// system check asks this module which of its .css values the gate freezes.

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
/** What a property's value is read for: a length (a radius, a font size, a shadow's geometry), a filter's drop-shadow(), or a time. */
const SCALE_OF = new Map([
  ...RADIUS_PROPERTIES.map((property) => [property, 'length']),
  ['font-size', 'length'],
  ['font', 'length'],
  ['box-shadow', 'length'],
  ['text-shadow', 'length'],
  ['filter', 'drop-shadow'],
  ...MOTION_PROPERTIES.map((property) => [property, 'duration']),
]);
// A non-zero length or time needs its unit, so a unitless number (a calc() factor, a colour's
// alpha) is never one.
const UNITS = {length: new Set(['px', 'rem', 'em']), duration: new Set(['ms', 's'])};

const DECLARATION = /(^|[{;\s])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]*?)\s*(?=[;}]|$)/g;
const VENDOR = /^-(?:webkit|moz|ms|o)-/;
const NUMBER = /(^|[\s,(/+*:-])(-?)(\d*\.?\d+)([a-z%]*)/gi;
const READS = /var\(\s*(--[\w-]+)/g;

/** A value's non-zero numbers, leaving out url()s and names (`var(--glow-2)`, `fade-2s`). */
function typedNumbers(value) {
  const text = value.replace(/url\([^)]*\)|--[\w-]+/gi, ' ');
  const numbers = [];
  for (const m of text.matchAll(NUMBER)) {
    const named = m[1] === '-' && /[a-z]/i.test(text[m.index - 1] ?? '');
    if (!named && Number(m[3]) !== 0) numbers.push({negative: m[2] === '-', unit: m[4].toLowerCase()});
  }
  return numbers;
}

/** How far a character moves the parenthesis depth. */
const depthStep = (char) => (char === '(' ? 1 : char === ')' ? -1 : 0);

/** The parts of a value between its top-level commas: one transition or animation each. */
function layers(value) {
  const parts = [''];
  let depth = 0;
  for (const char of value) {
    depth += depthStep(char);
    if (char === ',' && depth === 0) parts.push('');
    else parts[parts.length - 1] += char;
  }
  return parts;
}

/** Where the parenthesis opened just before `start` closes. */
function closingParen(text, start) {
  let depth = 1;
  for (let i = start; i < text.length; i += 1) {
    depth += depthStep(text[i]);
    if (depth === 0) return i;
  }
  return text.length;
}

/** What each drop-shadow() in a filter holds. */
const dropShadows = (value) =>
  [...value.matchAll(/drop-shadow\(/gi)].map((m) => {
    const start = m.index + m[0].length;
    return value.slice(start, closingParen(value, start));
  });

const typesLength = (value) => typedNumbers(value).some((n) => UNITS.length.has(n.unit));

/**
 * Whether a transition or animation types in a time. A decorative infinite animation keeps its
 * literal timings, as DURATION's scope in theme.ts says, and a negative delay phases a loop
 * already running, so neither counts.
 */
const typesDuration = (value) =>
  layers(value).some(
    (layer) =>
      !layer.toLowerCase().split(/\s+/).includes('infinite') &&
      typedNumbers(layer).some((n) => !n.negative && UNITS.duration.has(n.unit)),
  );

function typesScaleValue(scale, value) {
  if (scale === 'duration') return typesDuration(value);
  if (scale === 'drop-shadow') return dropShadows(value).some(typesLength);
  return typesLength(value);
}

/** SCALE_OF, plus each custom property a scale property in the same stylesheet reads, read as that property is. */
function scalesIn(declarations) {
  const scaleOf = new Map(SCALE_OF);
  for (const {property, value} of declarations) {
    const scale = SCALE_OF.get(property);
    const names = scale ? [...value.toLowerCase().matchAll(READS)].map((m) => m[1]) : [];
    for (const name of names.filter((n) => !scaleOf.has(n))) scaleOf.set(name, scale);
  }
  return scaleOf;
}

/** How many declarations in a stylesheet type in a radius, font size, shadow or duration. */
export function countScaleValues(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const declarations = [...text.matchAll(DECLARATION)].map(([, , property, value]) => ({
    property: property.toLowerCase().replace(VENDOR, ''),
    value,
  }));
  const scaleOf = scalesIn(declarations);
  return declarations.filter(({property, value}) => scaleOf.has(property) && typesScaleValue(scaleOf.get(property), value)).length;
}
