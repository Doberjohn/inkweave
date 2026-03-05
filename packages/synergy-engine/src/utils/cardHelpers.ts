import type {Ink, LorcanaCard} from '../types';

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
 * Check if card text contains a pattern (case-insensitive)
 * Normalizes newlines to spaces for matching across line breaks
 */
export function textContains(card: LorcanaCard, pattern: string | RegExp): boolean {
  if (!card.text) return false;
  // Normalize newlines to spaces for matching across line breaks
  const normalizedText = card.text.replace(/\n/g, ' ');
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
 * Shift variant type. Each variant carries its cost (parsed from the keyword).
 * - 'standard': targets same-name characters (e.g., "Shift 5")
 * - 'classification': targets characters with a specific classification (e.g., "Puppy Shift 3")
 * - 'universal': targets any character (e.g., "Universal Shift 4")
 */
export type ShiftType =
  | {kind: 'standard'; cost: number}
  | {kind: 'classification'; classification: string; cost: number}
  | {kind: 'universal'; cost: number};

/** Parse the numeric cost from a Shift keyword string like "Shift 5" or "Puppy Shift 3". */
function parseShiftCost(keyword: string): number {
  const match = keyword.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Determine the Shift variant and cost for a card, or null if it has no Shift keyword.
 * Handles "Shift N", "X Shift N" (classification), and "Universal Shift N".
 */
export function getShiftType(card: LorcanaCard): ShiftType | null {
  if (!card.keywords) return null;

  for (const kw of card.keywords) {
    const lower = kw.toLowerCase();
    if (lower.startsWith('universal shift')) {
      return {kind: 'universal', cost: parseShiftCost(kw)};
    }
    // "Puppy Shift 3" or "Puppy Shift" → classification variant
    if (lower.endsWith(' shift') || lower.match(/^\w+ shift \d+$/)) {
      const prefix = kw.split(/\s+shift\s*/i)[0];
      if (prefix && prefix.toLowerCase() !== kw.toLowerCase()) {
        return {kind: 'classification', classification: prefix, cost: parseShiftCost(kw)};
      }
    }
    if (lower.startsWith('shift')) {
      return {kind: 'standard', cost: parseShiftCost(kw)};
    }
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
// LOCATION SUPPORT DETECTION
// ============================================

/** Text patterns for each location-support role */
export const LOCATION_PATTERNS = {
  'at-payoff': /while\b.{0,60}at a location|if\b.{0,60}at a location|is at a location/i,
  move: /move.*to.*location|moves to a location|move.*character.*location|to the same location/i,
  'move-exclude': /move.*damage/i,
  'play-trigger': /when(?:ever)? you play a location|whenever.*play a location/i,
  'in-play-check': /if you have a location|while you have a.*(location)|for each location/i,
  tutor: /search.*location card|reveal.*location card|return a location|location card from/i,
  buff: /your locations|locations gain|locations get|location.*can't be challenged|location gains? resist/i,
  boost:
    /under.*(?:characters|character) or locations|under.*locations|locations with boost|play a character or location with boost/i,
  'location-ramp':
    /\bless\b.*(?:to )?(?:play|move).*location|\bless\b for.*location|play a location.*(?:from|for free)/i,
  /** Anti-location cards: banish/remove/shuffle locations. Excluded from location-control. */
  'anti-location': /banish (?:chosen |all )(?:item or )?location|shuffle.*location into/i,
} as const;

export type LocationRole =
  | 'at-payoff'
  | 'move'
  | 'play-trigger'
  | 'in-play-check'
  | 'tutor'
  | 'buff'
  | 'boost'
  | 'location-ramp';

/**
 * Get all location roles a card fulfills.
 * Returns empty array for cards with no location interaction.
 */
export function getLocationRoles(card: LorcanaCard): LocationRole[] {
  if (isLocation(card)) return [];
  if (!card.text) return [];

  // Anti-location cards (banish/remove locations) are excluded entirely
  if (LOCATION_PATTERNS['anti-location'].test(card.text)) return [];

  const roles: LocationRole[] = [];

  if (LOCATION_PATTERNS['at-payoff'].test(card.text)) roles.push('at-payoff');

  if (LOCATION_PATTERNS.move.test(card.text) && !LOCATION_PATTERNS['move-exclude'].test(card.text))
    roles.push('move');

  if (LOCATION_PATTERNS['play-trigger'].test(card.text)) roles.push('play-trigger');

  if (LOCATION_PATTERNS['in-play-check'].test(card.text)) roles.push('in-play-check');

  if (LOCATION_PATTERNS.tutor.test(card.text)) roles.push('tutor');

  if (LOCATION_PATTERNS.buff.test(card.text)) roles.push('buff');

  if (LOCATION_PATTERNS.boost.test(card.text)) roles.push('boost');

  if (LOCATION_PATTERNS['location-ramp'].test(card.text)) roles.push('location-ramp');

  return roles;
}

/**
 * Check if a card is a location-support card (matches any location pattern).
 */
export function isLocationSupportCard(card: LorcanaCard): boolean {
  return getLocationRoles(card).length > 0;
}

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
