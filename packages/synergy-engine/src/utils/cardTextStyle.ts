/**
 * Card text in the house style card data uses: the ⬡ ◊ ⟳ ¤ ⛉ glyphs, an em dash after an
 * activated ability's cost, "Shift N ⬡ (", and glyphs (not words) for ink amounts and stats.
 *
 * SINGLE SOURCE OF TRUTH (#635), as cardPath is: the /fetch-reveals scripts consume it through
 * the built engine, and reveal-admin through the package. This is what gets WRITTEN. The
 * engine's own text patterns stay strict, so a word form that slips past here costs a card its
 * mechanic tags (Honey Lemon 14151 lost its Ramp group to "pay 1 Ink less").
 */

/** Near-miss glyphs from vision readers and hand entry, mapped to the ones card data uses. */
const GLYPH_VARIANTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[◆◇⬥⬦◈♦]/gu, '◊'],
  [/[⬢⬣⎔⏣]/gu, '⬡'],
  [/[↻⟲⤾⭮🔄]/gu, '⟳'],
  [/[⚔🗡]/gu, '¤'],
  [/[⛨⛊🛡]/gu, '⛉'],
];

/**
 * U+FE0F, the invisible emoji selector a pasted glyph can carry ("⚔" + U+FE0F). Built from its
 * code point because a raw copy in source is invisible and silently lost by an edit.
 */
const VARIATION_SELECTOR_16 = String.fromCodePoint(0xfe0f);

/**
 * lorcanaplayer prints keyword headers as "Shift 5 (" where the card, and every Shift line in
 * allCards.json, prints "Shift 5 ⬡ (". Boost follows the same shape.
 */
const INK_COST_KEYWORD = /^((?:[A-Z][a-z]+ )*(?:Shift|Boost)) (\d+) \(/;

/**
 * Ink amounts and stats spelled out as words; released data always writes the glyph (0 word
 * forms in allCards.json). Case-sensitive: lowercase "N ink drops" is Set 14's mechanic word and
 * must stay. Lore is signed-only: released data keeps "gain N lore" as a lowercase word.
 *
 * An exert cost spelled "Exert" (Pirate Plane 14202, #667) becomes ⟳ only in cost position,
 * right before the em dash or a comma-separated cost that ends in one. Released data also uses
 * "Exert" as the verb ("Exert chosen opposing character."), never before a dash. The dash
 * normalization runs first, so "Exert, 2 Ink -" is covered.
 */
const GLYPH_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(\d+) Ink\b/g, '$1 ⬡'],
  [/([+-]?\b\d+) Strength\b/g, '$1 ¤'],
  [/([+-]?\b\d+) Willpower\b/g, '$1 ⛉'],
  [/([+-]\d+) Lore\b/g, '$1 ◊'],
  [/\bExert(?=(?:, [^—.\n]*)? —)/g, '⟳'],
];

/**
 * A "named X" reference, from "named" to the end of its clause or sentence: a comma,
 * semicolon, colon, parenthesis or line end, or a period followed by a space. A period after
 * a title or an initial sits inside the name instead ("Mr. Incredible", "P.J. Pete"): every
 * period in a shipped card name follows one. The reveal scripts unaccent everything it spans.
 * Global flag: use it with replace or matchAll, never test or exec, which keep lastIndex
 * between calls.
 */
export const NAMED_REFERENCE =
  /\bnamed (?:[^.,;:()\n]|\.(?!\s)|(?<=\b(?:[A-Z]|Mrs?|Ms|Dr|St|Jr|Sr))\.)+/g;

/** A capitalized glyph word; card data prints one only inside a card name. */
const GLYPH_WORD = /\b(?:Ink|Strength|Willpower|Lore)\b/g;

/**
 * Text that ends inside a card name: "named " and then only capitalized tokens ("named Ink
 * Amplifier", "named Mr. Incredible"). Narrower than NAMED_REFERENCE on purpose: in "named
 * Ink Amplifier and your Strength" the second glyph word is not part of the name.
 */
const ENDS_IN_CARD_NAME = /\bnamed (?:[A-Z0-9][^\s,;:()]* )*$/;

function unifyGlyphs(line: string): string {
  let s = line.replaceAll(VARIATION_SELECTOR_16, '');
  for (const [pattern, glyph] of GLYPH_VARIANTS) s = s.replace(pattern, glyph);
  return s;
}

/** One ability line in house style. Idempotent: canonical text passes through unchanged. */
export function canonicalizeCardLine(line: string): string {
  let s = unifyGlyphs(String(line))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+([.,;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/ [–-] /g, ' — ');
  for (const [pattern, glyph] of GLYPH_WORDS) s = s.replace(pattern, glyph);
  return s.replace(INK_COST_KEYWORD, '$1 $2 ⬡ (');
}

/** Canonical ability lines, blanks dropped: the fullTextSections shape. */
export function canonicalizeCardText(lines: readonly string[] | null | undefined): string[] {
  return (lines ?? []).map(canonicalizeCardLine).filter(Boolean);
}

/** A whole fullText value: every line canonical, blank separator lines kept. */
export function canonicalizeCardFullText(text: string): string {
  return text.replace(/\r\n/g, '\n').split('\n').map(canonicalizeCardLine).join('\n').trim();
}

/**
 * Capitalized glyph words in text exactly as written, except inside a card name after
 * "named". For text that reaches card data unrewritten, such as reveal-admin's keyword chips.
 */
export function findSpelledGlyphWords(text: string): string[] {
  return [...text.matchAll(GLYPH_WORD)]
    .filter((match) => !ENDS_IN_CARD_NAME.test(text.slice(0, match.index)))
    .map(([word]) => word);
}

/**
 * Capitalized glyph words left after canonicalizing: a shape the rules above do not know
 * ("Your Strength wins."). reveal-admin refuses to publish these.
 */
export function findGlyphWords(text: string): string[] {
  return findSpelledGlyphWords(canonicalizeCardFullText(text));
}
