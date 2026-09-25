/**
 * Text helpers shared by the reveal-sync parser and adjudicator.
 *
 * Two jobs, kept apart on purpose:
 * - canonicalize*: text in the house style previewCards.json already uses (the ⬡ ◊ ⟳ ¤ ⛉
 *   glyphs, an em dash after an activated ability's cost, "Shift N ⬡ ("). This is what
 *   gets WRITTEN, and the write step also spells names without accents (unaccented*).
 * - comparable*: a lossy key for deciding whether two readings agree. Never written.
 */

export const INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
export const CARD_TYPES = ['Character', 'Action', 'Item', 'Location'];

/** Vision readers emit near-miss glyphs; map each to the one the card data uses. */
const GLYPH_VARIANTS = [
  [/[◆◇⬥⬦◈♦]/gu, '◊'],
  [/[⬢⬣⎔⏣]/gu, '⬡'],
  [/[↻⟲⤾⭮🔄]/gu, '⟳'],
  [/[⚔🗡]/gu, '¤'],
  [/[⛨⛊🛡]/gu, '⛉'],
];

/**
 * lorcanaplayer prints keyword headers as "Shift 5 (" where the card, and every one of the
 * 78 Shift lines in allCards.json, prints "Shift 5 ⬡ (". Boost follows the same shape.
 */
const INK_COST_KEYWORD = /^((?:[A-Z][a-z]+ )*(?:Shift|Boost)) (\d+) \(/;

/** A keyword ability line: "Singer 5 (...)", "Alert (...)", "Puppy Shift 3 ⬡ (...)", "Rush". */
const KEYWORD_LINE = /^((?:[A-Z][a-z]+ ){0,3}[A-Z][a-z]+)(?: ([+-]?\d+))?(?: ⬡)?(?: \(.*\))?$/;

function unifyGlyphs(line) {
  let s = String(line).replace(/️/g, '');
  for (const [pattern, glyph] of GLYPH_VARIANTS) s = s.replace(pattern, glyph);
  return s;
}

/** One ability line in house style. Idempotent: canonical text passes through unchanged. */
export function canonicalizeLine(line) {
  return unifyGlyphs(line)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+([.,;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/ [–-] /g, ' — ')
    .replace(INK_COST_KEYWORD, '$1 $2 ⬡ (');
}

/** Canonical ability lines, blanks dropped. */
export function canonicalizeText(lines) {
  return (lines ?? []).map(canonicalizeLine).filter(Boolean);
}

/**
 * Without accents, as the owner rules card names ("Hector Rivera", "Mama Coco"): NFD, then
 * every combining mark dropped. Canonical decomposition only: the NFKD fold nameSlug uses for
 * matching would also rewrite "…" as "...", and this text is written.
 */
export function unaccented(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * A "named X" reference, from "named" to the end of its clause. A period does not end it,
 * because one can sit inside a name ("named Mr. Incredible").
 */
const NAMED_REFERENCE = /\bnamed [^,;:()\n]+/g;

/** An ability line with its "named X" references unaccented; the rest stays as printed. */
export function unaccentReferences(line) {
  return line.replace(NAMED_REFERENCE, unaccented);
}

/** Strip accents, unify quotes and dashes, lowercase: the comparison key for one line. */
export function comparable(line) {
  return canonicalizeLine(line)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/…/g, '...')
    .replace(/\s*[–—]\s*/g, ' - ')
    .toLowerCase();
}

/** Comparison key for a whole card text; joining with spaces tolerates different line splits. */
export function comparableText(lines) {
  return (lines ?? []).map(comparable).filter(Boolean).join(' ');
}

/** Comparison key for a name or version: accent-, case- and apostrophe-insensitive. */
export function comparableName(value) {
  return comparable(value ?? '').replace(/\s+/g, ' ');
}

/**
 * Keyword abilities as the reveal form expects them ("Singer 5", "Alert"), derived from
 * the card's own ability lines rather than trusted from either source.
 */
export function deriveKeywords(lines) {
  return canonicalizeText(lines)
    .map((line) => line.match(KEYWORD_LINE))
    .filter(Boolean)
    .map(([, keyword, value]) => (value ? `${keyword} ${value}` : keyword));
}

/** "Amber / Amethyst", "Amber-Amethyst", ["Ruby"] -> ink names in printed order. */
export function parseInks(value) {
  const raw = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  return raw
    .split(/[^A-Za-z]+/)
    .map((word) => INKS.find((ink) => ink.toLowerCase() === word.toLowerCase()))
    .filter(Boolean);
}

/** "Action • Song" -> "Action". Null when no card type is named. */
export function baseType(value) {
  const words = String(value ?? '')
    .split(/[^A-Za-z]+/)
    .map((w) => w.toLowerCase());
  return CARD_TYPES.find((type) => words.includes(type.toLowerCase())) ?? null;
}

const PLACEHOLDER = /^\[.*\]$|unreadable|illegible|unknown|\?/i;
const TYPE_WORDS = new Set(CARD_TYPES.map((t) => t.toLowerCase()));

function splitClassifications(value) {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(/[•·,|/]/);
  return parts.map((p) => String(p).trim()).filter(Boolean);
}

const isSubtype = (part) => !PLACEHOLDER.test(part) && !TYPE_WORDS.has(part.toLowerCase());

/** The subtype terms of a line, first spelling kept, each term once. */
function subtypeTerms(parts) {
  const seen = new Set();
  return parts.filter(isSubtype).filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The classification line as a subtype list. Drops the card type itself (the site files a
 * song as "Action • Song"; the data stores subtypes ["Song"]), any placeholder a reader used
 * for a term it could not read, and repeats: a card never lists a classification twice, and a
 * repeated term would otherwise let a two-term reading pass for a different two-term line.
 */
export function parseSubtypes(value) {
  return subtypeTerms(splitClassifications(value));
}

/**
 * A reader's classification line: its terms, and whether any term was unreadable. A value
 * that is neither a string nor an array is no reading at all (`terms: null`), which is not
 * the same as a line with no terms.
 */
export function readClassifications(value) {
  if (typeof value !== 'string' && !Array.isArray(value)) return {terms: null, partial: false};
  const parts = splitClassifications(value);
  return {terms: subtypeTerms(parts), partial: parts.some((p) => PLACEHOLDER.test(p))};
}

/** "Name - Version", or just the name for a card with no version. */
export function fullName(name, version) {
  return version ? `${name} - ${version}` : name;
}

/** "118/204" -> {number: 118, total: 204}; a bare "118" has no total; anything else is null. */
export function parseCollector(value) {
  const s = String(value ?? '').trim();
  const full = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (full) return {number: Number(full[1]), total: Number(full[2])};
  const bare = s.match(/^(\d+)$/);
  return bare ? {number: Number(bare[1]), total: null} : null;
}

/** An integer from a number or an integer-looking string, else null. */
export function toInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const s = String(value ?? '').trim();
  return /^[+-]?\d+$/.test(s) ? Number(s) : null;
}
