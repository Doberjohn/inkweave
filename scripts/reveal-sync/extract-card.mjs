/**
 * Turn a flattened lorcanaplayer card page into a site record.
 *
 * The browser flattener (browser.mjs) walks the page's <article>, writes one line per block
 * element and inlines each glyph <img> as its character. This module pairs the table's
 * labels with the lines that follow them. It is deliberately strict: a label every card
 * carries being absent means the markup changed, and returning blanks there would write
 * empty fields with no error anywhere. So it throws.
 */
import {
  baseType,
  canonicalizeText,
  parseCollector,
  parseInks,
  parseSubtypes,
  toInt,
} from './text.mjs';

export const LABELS = [
  'Name',
  'Card Type',
  'Version',
  'Ink Cost',
  'Inkwell',
  'Strength',
  'Willpower',
  'Lore',
  'Move Cost',
  'Ink Color',
  'Rarity',
  'Card ID',
  'Set',
  'Keywords + Abilities',
  'Classifications',
  'Card Text',
  'Flavor Text',
  'Illustrator',
  'Franchise',
  'Release Date',
  'Revealed',
];

/** Present on every card page, whatever its type. */
const UNIVERSAL = [
  'Name',
  'Card Type',
  'Ink Cost',
  'Inkwell',
  'Ink Color',
  'Rarity',
  'Card ID',
  'Set',
  'Keywords + Abilities',
  'Classifications',
  'Card Text',
];

/**
 * Present only for some types: actions and items carry no version and no stats. A
 * character's Strength row is not required: the site leaves it out when Strength is 0.
 */
const BY_TYPE = {
  Character: ['Version', 'Willpower', 'Lore'],
  Location: ['Version', 'Willpower', 'Lore', 'Move Cost'],
  Action: [],
  Item: [],
};

/** Retailer and share links after the table; the last label's value must stop before them. */
const FOOTER =
  /^(Amazon|TCGPlayer|Zatu Games|Card Information|Corrections & Errata|Found an error|Share on |These are affiliate)/;

export class SiteRecordError extends Error {
  constructor(slug, message) {
    super(`${slug}: ${message}`);
    this.name = 'SiteRecordError';
  }
}

function indexLabels(lines) {
  const index = new Map();
  lines.forEach((line, i) => {
    if (LABELS.includes(line) && !index.has(line)) index.set(line, i);
  });
  return index;
}

function requireLabels(index, labels, slug) {
  const missing = labels.filter((label) => !index.has(label));
  if (missing.length)
    throw new SiteRecordError(slug, `page is missing ${missing.join(', ')} (markup changed?)`);
}

/** Every line after a label, up to the next label or the footer. */
function valuesAfter(lines, index, label) {
  if (!index.has(label)) return [];
  const values = [];
  for (let i = index.get(label) + 1; i < lines.length; i++) {
    if (LABELS.includes(lines[i]) || FOOTER.test(lines[i])) break;
    values.push(lines[i]);
  }
  return values;
}

/**
 * lorcanaplayer leaves the Strength row out of a character page when Strength is 0, so a
 * missing row reads as 0. The blind readers check every stat against the official scan, so
 * a wrong 0 gets more readers and is never written silently.
 */
function strengthOf(type, index, one) {
  if (type === 'Character' && !index.has('Strength')) return 0;
  return toInt(one('Strength'));
}

function yesNo(value) {
  if (value === 'Yes') return true;
  if (value === 'No') return false;
  return null;
}

/**
 * Parse one card page. `slug` and `imageFile` ride along for error messages and the
 * language gate; neither is read from the lines.
 */
export function parseCardLines(lines, {slug = '?', imageFile = null} = {}) {
  const index = indexLabels(lines);
  requireLabels(index, UNIVERSAL, slug);
  const one = (label) => valuesAfter(lines, index, label)[0] ?? null;

  const cardType = one('Card Type');
  const type = baseType(cardType);
  if (!type) throw new SiteRecordError(slug, `unrecognised card type "${cardType}"`);
  requireLabels(index, BY_TYPE[type], slug);

  return {
    slug,
    imageFile,
    name: one('Name'),
    version: one('Version'),
    type,
    cost: toInt(one('Ink Cost')),
    inkwell: yesNo(one('Inkwell')),
    strength: strengthOf(type, index, one),
    willpower: toInt(one('Willpower')),
    lore: toInt(one('Lore')),
    moveCost: toInt(one('Move Cost')),
    inks: parseInks(one('Ink Color')),
    rarity: one('Rarity'),
    collector: parseCollector(one('Card ID')),
    set: one('Set'),
    keywordsField: one('Keywords + Abilities'),
    subtypes: parseSubtypes(one('Classifications')),
    text: canonicalizeText(valuesAfter(lines, index, 'Card Text')),
    franchise: one('Franchise'),
    illustrator: one('Illustrator'),
  };
}
