import type {Ink, LorcanaCard} from '../types';

// The card helpers every rule shares: ink, text normalization, keywords, Shift parsing, card types
// and the shared text patterns. Each rule's own text detection lives in ./detection/<rule>.ts.

// ============================================
// INK COMPATIBILITY
// ============================================

/** Returns true if the card is dual-ink (has two ink colors). */
export function isDualInk(card: LorcanaCard): boolean {
  return card.ink2 != null;
}

/** Returns all ink colors on a card (1 for single-ink, 2 for dual-ink). */
export function getInks(card: LorcanaCard): Ink[] {
  return card.ink2 ? [card.ink, card.ink2] : [card.ink];
}

/**
 * Check if two cards could exist in the same Lorcana deck.
 *
 * A deck has exactly 2 ink colors. Dual-ink cards lock the deck to those 2 inks.
 * - If either card is dual-ink, the other card's ink(s) must be a subset of those 2.
 * - If both are single-ink, they can always share a deck (the deck's 2 inks include both).
 */
export function canShareDeck(cardA: LorcanaCard, cardB: LorcanaCard): boolean {
  const aDual = isDualInk(cardA);
  const bDual = isDualInk(cardB);

  // Both single-ink: any two single-ink cards can share a deck
  if (!aDual && !bDual) return true;

  const dualCard = aDual ? cardA : cardB;
  const otherCard = aDual ? cardB : cardA;
  const dualInks = getInks(dualCard);

  if (aDual && bDual) {
    // Both dual-ink: must have the exact same ink pair
    const otherInks = getInks(otherCard);
    return dualInks.every((i) => otherInks.includes(i));
  }

  // One dual, one single: the single card's ink must be in the dual's pair
  return dualInks.includes(otherCard.ink);
}

/**
 * Typographic single quotes (U+2018, U+2019). Reveal-season preview text prints them
 * ("can’t", "player’s"), while LorcanaJSON text and every engine pattern use the straight '.
 * Global flag: use it with .replace only, since a /g regex's .test() keeps lastIndex state.
 */
const TYPOGRAPHIC_APOSTROPHE = /[‘’]/g;

/**
 * Card text as normalizeCardText returns it: newlines read as spaces and typographic apostrophes
 * as the straight '. Every engine pattern is written against this form, so a helper that takes
 * NormalizedText can't be handed raw card.text by mistake. Cutting sentences or clauses out of it
 * keeps it normalized, so a helper may re-brand the text it derives.
 */
export type NormalizedText = string & {readonly __brand: 'NormalizedText'};

/**
 * Normalize card text for regex matching: newlines become spaces, typographic apostrophes
 * become the straight '.
 *
 * Lorcana card text spans multiple lines, and JS regex `.*` does not cross newlines by
 * default, so "reveal\na location card" silently fails `reveal.*location card`. Preview text
 * prints ’ where every pattern spells ', so "their player’s hand" would fail each
 * `player'?s?` pattern. Always route card-text patterns through this helper so detection and
 * rule `matches` agree. It feeds matching only; displayed text keeps its printed form.
 *
 * Returns an empty string when the card has no text, so callers can chain safely.
 */
export function normalizeCardText(card: LorcanaCard): NormalizedText {
  const text = (card.text ?? '').replace(/\n/g, ' ').replace(TYPOGRAPHIC_APOSTROPHE, "'");
  return text as NormalizedText;
}

/**
 * Check if card text contains a pattern (case-insensitive)
 * Normalizes newlines to spaces for matching across line breaks
 */
export function textContains(card: LorcanaCard, pattern: string | RegExp): boolean {
  if (!card.text) return false;
  const normalizedText = normalizeCardText(card);
  if (typeof pattern === 'string') {
    return normalizedText.toLowerCase().includes(pattern.toLowerCase());
  }
  return pattern.test(normalizedText);
}

/**
 * Check if card has a keyword (case-insensitive, prefix match)
 */
export function hasKeyword(card: LorcanaCard, keyword: string): boolean {
  return card.keywords?.some((k) => k.toLowerCase().startsWith(keyword.toLowerCase())) ?? false;
}

/**
 * Check if card has a keyword (exact match, case-insensitive)
 */
export function hasKeywordExact(card: LorcanaCard, keyword: string): boolean {
  return card.keywords?.some((k) => k.toLowerCase() === keyword.toLowerCase()) ?? false;
}

/**
 * Check if card has a classification (case-insensitive)
 */
export function hasClassification(card: LorcanaCard, classification: string): boolean {
  return (
    card.classifications?.some((c) => c.toLowerCase() === classification.toLowerCase()) ?? false
  );
}

/**
 * Extract the base name for Shift matching (before the comma)
 * e.g., "Elsa, Snow Queen" -> "Elsa"
 */
export function getBaseName(card: LorcanaCard): string {
  return card.name.split(',')[0].trim();
}

/**
 * Every base name a Shift card can land on.
 *
 * Most Shift cards target a single name — their own — so this is usually a
 * one-element list. But "Team" cards print a compound name ("Belle & Beast",
 * "Lilo & Stitch", "Carl Fredricksen & Russell") whose reminder reads
 * "named X or Y", making EACH half a valid Shift base. Decomposing the compound
 * name lets a "Belle & Beast" shifter match both "Belle" and "Beast" bases
 * instead of a literal "Belle & Beast" character that never exists.
 *
 * The Shift matcher (isValidShiftTarget, standard variant) checks a target's
 * base name against this list, so returning extra names only ADDS matches —
 * an atomic name must still come back as a single-element list unchanged.
 */
export function getShiftBaseNames(card: LorcanaCard): string[] {
  const base = getBaseName(card);
  // "Team" cards print a compound name ("Belle & Beast") whose reminder reads
  // "named X or Y", so each half is a valid Shift base. Split on the ampersand
  // (not spaces — keeps multi-word halves like "Carl Fredricksen" intact) and
  // return the components alongside the full name. Atomic names have no "&" and
  // pass through unchanged. Split on "&" only: the card NAMES use it, while
  // " and "/" or " can appear inside a single legitimate name.
  if (!base.includes('&')) return [base];
  const parts = base.split('&').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? [base, ...parts] : [base];
}

/**
 * A character that also takes another name, for Shift only: "This character also counts as
 * being named Syndrome for Shift." (Incrediboy - Buddy Pine). A Shift onto Syndrome can land on
 * it, so it is a Shift base for that name, not a card that names a companion.
 */
export const SHIFT_ALIAS_PATTERN = /\bcounts as being named\s+(.+?)\s+for\s+Shift\b/gi;

/** The other names a character counts as for Shift; most cards have none. */
export function getShiftAliasNames(card: LorcanaCard): string[] {
  // Cheap gate on the raw text: the Shift matcher asks this of every character.
  if (!card.text || !/\bfor\s+Shift\b/i.test(card.text)) return [];
  return [...normalizeCardText(card).matchAll(SHIFT_ALIAS_PATTERN)].map((match) => match[1].trim());
}

/**
 * How a Shift cost is paid: ink from the inkwell ("Shift 5"), or ink drops you remove
 * ("Shift Remove 2 ink drops", Set 14). A ShiftType's `cost` counts in that unit.
 */
export type ShiftPayment = 'ink' | 'ink-drops';

/**
 * Shift variant type. `kind` is where the Shift lands; `cost` and `payment` are how it is paid.
 * - 'standard': targets same-name characters (e.g., "Shift 5")
 * - 'classification': targets characters with a specific classification (e.g., "Puppy Shift 3")
 * - 'universal': targets any character (e.g., "Universal Shift 4")
 * - 'named-item': targets an ITEM by name (e.g., "Potato Shift 5" → items named Potato)
 */
export type ShiftType = (
  | {kind: 'standard'}
  | {kind: 'classification'; classification: string}
  | {kind: 'universal'}
  | {kind: 'named-item'; itemName: string}
) & {cost: number; payment: ShiftPayment};

/**
 * Parse a Shift keyword's cost. Ink drops are read first: that keyword ends in "drops", not a
 * number, so the ink read would fall through to 0 and score it as a free Shift.
 */
function parseShiftCost(keyword: string): {cost: number; payment: ShiftPayment} {
  const drops = keyword.match(/(\d+)\s+ink\s+drops?\s*$/i);
  if (drops) return {cost: parseInt(drops[1], 10), payment: 'ink-drops'};
  const ink = keyword.match(/(\d+)\s*$/);
  return {cost: ink ? parseInt(ink[1], 10) : 0, payment: 'ink'};
}

/**
 * Classify a single keyword string into a Shift variant, or null if it isn't Shift.
 *
 * `isTeam` marks a compound-name card ("Belle & Beast", "Sulley & Boo"). Team cards shift
 * onto either named half regardless of the keyword's flavor label (plain Shift, Combo Shift,
 * Duo Shift), so they classify as `standard` and let `getShiftBaseNames` decompose the name.
 * Non-team `<prefix> Shift N` keywords are genuine classification shifts (Puppy, Floodborn,
 * Madrigal, Red Panda) — the prefix names the targeted classification.
 */
function classifyShiftKeyword(kw: string, isTeam = false): ShiftType | null {
  const lower = kw.toLowerCase();
  if (!lower.includes('shift')) return null;
  // Universal Shift targets any character — checked first so a team card that somehow has
  // Universal Shift still keeps every target rather than being narrowed to its named halves.
  if (lower.startsWith('universal shift')) {
    return {kind: 'universal', ...parseShiftCost(kw)};
  }
  // Team cards shift onto either half of their compound name. "Combo Shift" / "Duo Shift"
  // read like classification prefixes but aren't — the '&' name is the real signal, and
  // getShiftBaseNames (used by the matcher) splits it. Routes plain/Combo/Duo team shifts alike.
  if (isTeam) {
    return {kind: 'standard', ...parseShiftCost(kw)};
  }
  // Strip a leading "Temporary " modifier: it bounces the card to hand at end of turn but
  // doesn't change WHO it shifts onto. "Temporary Shift N" → standard; "Temporary Red Panda
  // Shift N" → the underlying "Red Panda" classification shift.
  const core = lower.startsWith('temporary ') ? kw.slice('Temporary '.length) : kw;
  // "<classification> Shift N" / "<classification> Shift" → classification variant. The prefix
  // may be multiple words ("Red Panda Shift 2"), so match lazily up to the trailing " Shift".
  const classMatch = core.match(/^(.+?)\s+shift(?:\s+\d+)?$/i);
  if (classMatch) {
    return {kind: 'classification', classification: classMatch[1].trim(), ...parseShiftCost(kw)};
  }
  // Plain "Shift N" (including a "Temporary Shift N" reduced to "Shift N") → standard. A Shift
  // paid in ink drops ("Shift Remove 2 ink drops") lands here too: only its payment differs.
  if (core.toLowerCase().startsWith('shift')) {
    return {kind: 'standard', ...parseShiftCost(kw)};
  }
  return null;
}

/**
 * Item-target Shift ("Potato Shift 5" → items named Potato) is distinguished from a
 * classification shift ("Puppy Shift 3") only by its reminder text — the keyword prefix
 * reads identically. So the item name comes from the reminder, not the keyword. Returns
 * the item's name, or null when the card isn't an item-target shift.
 *
 * The name runs to the reminder's closing `)` (with its trailing sentence period stripped),
 * so item names with internal periods ("Mr. Potato Head") aren't truncated — matching how
 * getNamedReferences tolerates periods in character names.
 */
const ITEM_SHIFT_TARGET = /on top of one of your items? named ([^)]+?)\.?\)/i;

function itemShiftName(card: LorcanaCard): string | null {
  const match = normalizeCardText(card).match(ITEM_SHIFT_TARGET);
  return match ? match[1].trim() : null;
}

/**
 * Determine the Shift variant and cost for a card, or null if it has no Shift keyword.
 * Handles "Shift N", "Temporary Shift N", "Combo/Duo Shift N" (team), "<Class> Shift N"
 * (classification, single- or multi-word), "Universal Shift N", and item-target
 * "<Item> Shift N" (an "items named X" reminder → named-item).
 */
export function getShiftType(card: LorcanaCard): ShiftType | null {
  if (!card.keywords) return null;
  // Compound-name cards ("Belle & Beast", "Sulley & Boo") shift onto either named half
  // regardless of the shift's flavor label, so flag them for the classifier to route to
  // `standard` (where getShiftBaseNames decomposes the name).
  const isTeam = card.name.includes('&');
  // An "items named X" reminder marks an item-target shift. Its keyword prefix ("Potato")
  // reads like a classification, so reinterpret the classified shift as `named-item`
  // (keeping the parsed cost) instead of a nonexistent "Potato" character classification.
  const itemName = itemShiftName(card);
  for (const kw of card.keywords) {
    const variant = classifyShiftKeyword(kw, isTeam);
    if (!variant) continue;
    const {cost, payment} = variant;
    return itemName ? {kind: 'named-item', itemName, cost, payment} : variant;
  }
  return null;
}

/**
 * Check if a card has any kind of Shift keyword (standard, classification, or universal).
 */
export function hasAnyShift(card: LorcanaCard): boolean {
  return getShiftType(card) !== null;
}

/**
 * Duo Shift's reminder: "play this on top of two of your characters, one named Mickey Mouse and
 * one named Minnie Mouse." It lands on both halves at once, so neither half takes it alone.
 * Combo Shift's reminder ("one named Sulley, one named Boo, or one of each") takes either half,
 * as a plain team Shift does.
 */
const DUO_SHIFT_PATTERN = /\bon top of two of your characters\b/i;

/** The Shift needs both named halves in play (Mickey Mouse & Minnie Mouse - Adventuring Duo). */
export function isDuoShift(card: LorcanaCard): boolean {
  return DUO_SHIFT_PATTERN.test(normalizeCardText(card));
}

/** An effect that gets ink drops: "get 2 ink drops", "each player gets 1 ink drop". */
const INK_DROP_GAIN = /\bgets?\s+(\d+)\s+ink\s+drops?\b/gi;

/**
 * The most ink drops any one of the card's effects gets, or 0: 2 for Baymax - Lab Assistant's
 * RESUPPLY. "If you would get an ink drop" and "remove 2 ink drops" are not gains.
 */
export function getInkDropGain(card: LorcanaCard): number {
  let most = 0;
  for (const [, count] of normalizeCardText(card).matchAll(INK_DROP_GAIN)) {
    most = Math.max(most, parseInt(count, 10));
  }
  return most;
}

/**
 * Get the numeric value from a keyword like "Singer 5" -> 5
 */
export function getKeywordValue(card: LorcanaCard, keyword: string): number | null {
  const match = card.keywords?.find((k) => k.toLowerCase().startsWith(keyword.toLowerCase()));
  if (!match) return null;

  const parts = match.split(' ');
  if (parts.length < 2) return null;

  const value = parseInt(parts[1], 10);
  return isNaN(value) ? null : value;
}

/**
 * Check if card is a song (Action with Song subtype or "song" in text)
 */
export function isSong(card: LorcanaCard): boolean {
  return (
    card.type === 'Action' && (card.classifications?.includes('Song') || textContains(card, 'song'))
  );
}

/**
 * Check if card is a character
 */
export function isCharacter(card: LorcanaCard): boolean {
  return card.type === 'Character';
}

/**
 * Check if card is an action
 */
export function isAction(card: LorcanaCard): boolean {
  return card.type === 'Action';
}

/**
 * Check if card is an item
 */
export function isItem(card: LorcanaCard): boolean {
  return card.type === 'Item';
}

/**
 * Check if card is a location
 */
export function isLocation(card: LorcanaCard): boolean {
  return card.type === 'Location';
}

// ============================================
// SHARED TEXT PATTERNS
// ============================================

/** A sentence break: the whitespace after ".", "!" or "?". */
export const SENTENCE_BREAK = /(?<=[.!?])\s+/;

/**
 * Generic Search-mechanic pattern factory.
 * Detects strict deck → hand shapes:
 *   1. "look at the top X cards → reveal TARGET" (search-to-hand)
 *   2. "search your deck/discard/hand for TARGET" (explicit search)
 *   3. "return TARGET" (return-to-hand)
 *
 * Deliberately excludes "TARGET from your discard" because that shape is shared
 * by recursion mechanics (move TARGET from discard → deck) which are semantically
 * distinct from Search. Recursion deserves its own role; see Phase 3.
 *
 * Used by Locations (target='location card') and Toys (target='Toy character'),
 * extensible to future tribes. `target` is treated as a regex fragment, not a literal.
 */
export function makeSearchPattern(target: string): RegExp {
  return new RegExp(
    'look at the top \\d+ cards.{0,80}?reveal.{0,40}?' +
      target +
      '|search.{0,80}?(?:deck|discard|hand).{0,40}?' +
      target +
      '|return (?:a |an )?' +
      target,
    'i',
  );
}

/**
 * Generic Banish-Trigger pattern factory.
 * Detects reactive on-banish triggers — strict tense: "when(ever) X is/are/gets banished".
 * Excludes "if X was banished this turn" (turn-state condition, not a reactive trigger);
 * those cards live under self-discount or other state-check mechanics.
 *
 * `target` is treated as a regex fragment, not a literal — pass classification phrases
 * like 'Toy characters?' or self-references like 'this character'.
 */
export function makeBanishTriggerPattern(target: string): RegExp {
  return new RegExp(
    'when(?:ever)?\\s+(?:a\\s+|an\\s+|your\\s+other\\s+|one of your other\\s+)?' +
      target +
      '\\s+(?:is|are|gets?)\\s+banished',
    'i',
  );
}

// ============================================
// CLASSIFICATION TARGETING
// ============================================

/**
 * Check if card text contains a NEGATIVE effect targeting a classification
 * e.g., "exert chosen Princess", "banish target Villain"
 */
export function hasNegativeTargeting(card: LorcanaCard, classification: string): boolean {
  if (!card.text) return false;
  const text = card.text.toLowerCase();
  const classLower = classification.toLowerCase();

  // Patterns that indicate negative targeting of the classification
  const negativePatterns = [
    `exert chosen ${classLower}`,
    `exert target ${classLower}`,
    `exert a ${classLower}`,
    `exert an opposing ${classLower}`,
    `banish chosen ${classLower}`,
    `banish target ${classLower}`,
    `banish a ${classLower}`,
    `damage to ${classLower}`,
    `damage to chosen ${classLower}`,
    `damage to target ${classLower}`,
    `return chosen ${classLower}`,
    `return target ${classLower}`,
  ];

  return negativePatterns.some((pattern) => text.includes(pattern));
}

/**
 * Check if card text contains a POSITIVE effect for a classification
 * e.g., "Princess characters get +1", "your Villains gain", "whenever a Hero"
 */
export function hasPositiveClassificationEffect(
  card: LorcanaCard,
  classification: string,
): boolean {
  if (!card.text) return false;
  const text = card.text.toLowerCase();
  const classLower = classification.toLowerCase();

  // Patterns that indicate positive synergy with the classification
  const positivePatterns = [
    `${classLower} character gets`,
    `${classLower} characters get`,
    `${classLower} character gains`,
    `${classLower} characters gain`,
    `your ${classLower}`,
    `each ${classLower}`,
    `another ${classLower}`,
    `whenever a ${classLower}`,
    `whenever an ${classLower}`,
    `when a ${classLower}`,
    `when an ${classLower}`,
    `if you have a ${classLower}`,
    `for each ${classLower}`,
    `named ${classLower}`,
  ];

  return positivePatterns.some((pattern) => text.includes(pattern));
}
