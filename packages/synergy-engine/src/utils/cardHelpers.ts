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

// ============================================
// DISCARD CONTROL DETECTION
// ============================================

/** Discard role: enabler (forces opponent to discard) or payoff (rewards hand-size advantage) */
export type DiscardRole = 'enabler' | 'payoff';

/**
 * Enabler patterns — cards that force opponents to lose cards from hand.
 * Covers: forced discard, targeted (reveal+pick), hand-cap, symmetric, and indirect.
 */
const DISCARD_ENABLER_PATTERNS: RegExp[] = [
  // "each/chosen opponent chooses and discards" + "have opponent choose and discard"
  /(each|chosen)\s+opponents?\s+(chooses?\s+and\s+discards?|reveals?\s+their\s+hand\s+and\s+discards?|discards?)/i,
  /have\s+(each|chosen)\s+opponents?\s+choose\s+and\s+discard/i,
  // Symmetric / indirect: "each/challenging player...discards", "that player discards at random"
  /(each|challenging)\s+player\s+(?:may\s+)?chooses?\s+and\s+discards?/i,
  /that\s+player\s+discards?\s+a\s+card\s+at\s+random/i,
  // Hand-cap: "more than X cards in their hand...discard"
  /more\s+than\s+\d+\s+cards\s+in\s+their\s+hand.*discard/i,
  // Comparative: "most cards in their hands choose and discard"
  /most\s+cards\s+in\s+their\s+hands?\s+choose\s+and\s+discard/i,
  // Symmetric chaos: "each player draws X cards...discards X cards at random"
  /each\s+player\s+draws\s+\d+\s+cards.*discards\s+\d+\s+cards\s+at\s+random/i,
];

/** Payoff pattern — cards that reward having more cards in hand than opponent */
const DISCARD_PAYOFF_PATTERN = /more\s+cards\s+in\s+your\s+hand\s+than\s+(?:each\s+)?opponents?/i;

/** Fast pre-filter: all enabler patterns contain "discard", payoff contains "hand" */
const HAS_DISCARD_KEYWORD = /discard|more cards in your hand/i;

/**
 * Determine the discard role(s) a card fulfills.
 * Returns an array of roles (a card could theoretically be both).
 */
export function getDiscardRoles(card: LorcanaCard): DiscardRole[] {
  if (!card.text) return [];
  if (!HAS_DISCARD_KEYWORD.test(card.text)) return [];
  const normalizedText = card.text.replace(/\n/g, ' ');

  const roles: DiscardRole[] = [];

  if (DISCARD_ENABLER_PATTERNS.some((p) => p.test(normalizedText))) {
    roles.push('enabler');
  }

  if (DISCARD_PAYOFF_PATTERN.test(normalizedText)) {
    roles.push('payoff');
  }

  return roles;
}

/**
 * Check if a card is a discard control card (enabler or payoff).
 */
export function isDiscardCard(card: LorcanaCard): boolean {
  return getDiscardRoles(card).length > 0;
}

// ============================================
// RAMP DETECTION
// ============================================

/**
 * Ramp roles:
 * - inkwell-ramp: cards that put extra cards into your inkwell (deck→ink or hand/board→ink)
 * - inkwell-trigger: cards that fire "whenever a card is put into your inkwell"
 * - cost-reduction: cards that reduce cost of OTHER cards you play
 */
export type RampRole = 'inkwell-ramp' | 'inkwell-trigger' | 'cost-reduction';

/**
 * Inkwell ramp patterns — cards that put cards into YOUR inkwell.
 * Covers: deck-top ramp, hand-to-inkwell, board-to-inkwell, discard-to-inkwell.
 */
const INKWELL_RAMP_PATTERNS: RegExp[] = [
  // "put the top card of your deck into your inkwell"
  /put\s+the\s+top\s+card\s+of\s+your\s+deck\s+into\s+your\s+inkwell/i,
  // "look at the top X cards...put...into your inkwell"
  /look\s+at\s+the\s+top.*?put.*?into\s+your\s+inkwell/i,
  // "put up to X cards from your discard into your inkwell"
  /put\s+up\s+to\s+\d+\s+cards?\s+from\s+your\s+discard\s+into\s+your\s+inkwell/i,
  // "put a card from your hand into your inkwell"
  /put\s+a\s+card\s+from\s+your\s+hand\s+into\s+your\s+inkwell/i,
  // "you may put an additional card from your hand into your inkwell"
  /additional\s+card.*?into\s+your\s+inkwell/i,
  // "put chosen character of yours into your inkwell"
  /put\s+chosen\s+(?:character|item|location)\s+(?:of\s+yours\s+)?into\s+your\s+inkwell/i,
  // "put this card into your inkwell"
  /put\s+this\s+card\s+into\s+your\s+inkwell/i,
  // "put that card into your inkwell" (e.g. banished characters going to your inkwell)
  /put\s+that\s+card\s+(?:from\s+your\s+discard\s+)?into\s+your\s+inkwell/i,
  // "put any number of cards from under your characters...into your inkwell"
  /put\s+any\s+number\s+of\s+cards.*?into\s+your\s+inkwell/i,
  // "put cards from under...into your inkwell" (boosted cards)
  /put\s+the\s+top\s+card\s+of\s+your\s+deck\s+facedown\s+under/i,
];

/**
 * Opponent-ink exclusion — cards that put stuff into the OPPONENT'S inkwell.
 * These are removal, not ramp: they don't fire YOUR triggers or give YOU more ink.
 */
const OPPONENT_INK_PATTERN =
  /into\s+(?:its|their)\s+player'?s?\s+inkwell|into\s+their\s+inkwell|opponent.*?puts?\s+the\s+top\s+card\s+of\s+their\s+deck\s+into\s+their\s+inkwell/i;

/**
 * Inkwell trigger patterns — "whenever a card is put into your inkwell".
 * Includes variant wordings: "whenever you put a card into your inkwell",
 * "when you put a card into your inkwell".
 */
const INKWELL_TRIGGER_PATTERNS: RegExp[] = [
  /whenever\s+a\s+card\s+is\s+put\s+into\s+your\s+inkwell/i,
  /whenever\s+you\s+put\s+a\s+card\s+into\s+your\s+inkwell/i,
  /when\s+you\s+put\s+a\s+card\s+into\s+your\s+inkwell/i,
];

/**
 * Cost reduction grant patterns — cards that reduce cost of OTHER cards.
 * Must match "you pay X less" but NOT "you pay X less to play this" (self-discount).
 */
const COST_REDUCTION_GRANT_PATTERN = /you\s+pay\s+\d+\s+⬡?\s*less/i;
const COST_REDUCTION_SELF_PATTERN = /you\s+pay\s+\d+\s+⬡?\s*less\s+to\s+play\s+this/i;

/** Fast pre-filter: skip cards without any ramp-related keywords */
const HAS_RAMP_KEYWORD = /inkwell|you pay \d+.*less/i;

/**
 * Determine the ramp role(s) a card fulfills.
 * A card can have multiple roles (e.g., a card that both ramps and triggers).
 */
export function getRampRoles(card: LorcanaCard): RampRole[] {
  if (!card.text) return [];
  if (!HAS_RAMP_KEYWORD.test(card.text)) return [];
  const t = card.text.replace(/\n/g, ' ');

  const roles: RampRole[] = [];

  // Check inkwell ramp (must put cards into YOUR inkwell, not opponent's)
  const isRamp = INKWELL_RAMP_PATTERNS.some((p) => p.test(t));
  const isOpponentInk = OPPONENT_INK_PATTERN.test(t);
  const alsoSelfRamps = /into\s+your\s+inkwell/i.test(t);
  if (isRamp && (!isOpponentInk || alsoSelfRamps)) {
    roles.push('inkwell-ramp');
  }

  // Check inkwell trigger
  if (INKWELL_TRIGGER_PATTERNS.some((p) => p.test(t))) {
    roles.push('inkwell-trigger');
  }

  // Check cost reduction grant (reduces cost of OTHER cards, not self)
  if (COST_REDUCTION_GRANT_PATTERN.test(t) && !COST_REDUCTION_SELF_PATTERN.test(t)) {
    roles.push('cost-reduction');
  }

  return roles;
}

/**
 * Check if a card is a ramp card (any ramp role).
 */
export function isRampCard(card: LorcanaCard): boolean {
  return getRampRoles(card).length > 0;
}

/**
 * Sub-pattern detection for scoring nuance.
 * Returns whether an inkwell ramp card uses deck ramp (free) vs self-sacrifice (card cost).
 */
export function isDeckRamp(card: LorcanaCard): boolean {
  if (!card.text) return false;
  const t = card.text.replace(/\n/g, ' ');
  return /put\s+the\s+top\s+card\s+of\s+your\s+deck\s+into\s+your\s+inkwell/i.test(t) ||
    /look\s+at\s+the\s+top.*?put.*?into\s+your\s+inkwell/i.test(t) ||
    /put\s+up\s+to\s+\d+\s+cards?\s+from\s+your\s+discard\s+into\s+your\s+inkwell/i.test(t);
}

/**
 * Sub-pattern detection: returns whether a trigger fires every ink event (true)
 * or is capped at once per turn (false).
 */
export function isRepeatingTrigger(card: LorcanaCard): boolean {
  if (!card.text) return false;
  const t = card.text.replace(/\n/g, ' ');
  if (!INKWELL_TRIGGER_PATTERNS.some((p) => p.test(t))) return false;
  return !/once\s+during\s+your\s+turn/i.test(t);
}

/**
 * Broad card type that a cost reduction card targets.
 * Used to determine if two cost-reduction cards can stack on the same play.
 */
export type CostReductionTarget = 'character' | 'location' | 'action' | 'item';

/**
 * Detect what card type a cost reduction grant discounts.
 * Returns the broad target type. Tribe-specific discounts (Pirate, Puppy, Princess)
 * map to 'character' since they're subtypes of character.
 * Returns null if card is not a cost reduction grant.
 */
export function getCostReductionTarget(card: LorcanaCard): CostReductionTarget | null {
  if (!card.text) return null;
  const t = card.text.replace(/\n/g, ' ');
  if (!COST_REDUCTION_GRANT_PATTERN.test(t) || COST_REDUCTION_SELF_PATTERN.test(t)) return null;

  // Extract the text after "you pay X less"
  const match = t.match(/you\s+pay\s+\d+\s+⬡?\s*less\s+(?:for\s+the\s+(?:next|first)\s+|to\s+play\s+)(.{0,60})/i);
  const snippet = match?.[1] ?? '';

  if (/location/i.test(snippet)) return 'location';
  if (/action/i.test(snippet)) return 'action';
  if (/item/i.test(snippet)) return 'item';
  // Everything else is a character variant (generic, Princess, Pirate, Puppy, Inventor, Shift, named)
  return 'character';
}

/**
 * Check if two cost reduction cards target overlapping types (can stack on the same play).
 */
export function costReductionTargetsOverlap(cardA: LorcanaCard, cardB: LorcanaCard): boolean {
  const targetA = getCostReductionTarget(cardA);
  const targetB = getCostReductionTarget(cardB);
  if (targetA == null || targetB == null) return false;
  return targetA === targetB;
}

// ============================================
// NAMED COMPANION DETECTION
// ============================================

/** Regex to strip Shift parentheticals from card text before scanning for named references */
const SHIFT_PARENTHETICAL = /Shift \d+[^(]*\([^)]*\)/gi;

/**
 * Game-mechanic terminator pattern (as regex source string) that signals the
 * end of a card name. Names can contain lowercase articles ("the", "of"),
 * periods ("Mr."), hyphens ("Fix-It"), and exclamation marks ("Pull the
 * Lever!"), so we stop at words that clearly belong to game rules text.
 *
 * Also terminates on comma (handles "named Pete, you may...") and on
 * "and/or" followed by a non-capitalized word (game text continuation).
 */
const NAME_TERMINATOR_SOURCE = [
  // Game-mechanic verbs and prepositions
  "\\s+(?:in\\b|can\\b|can't\\b|may\\b|gets?\\b|gains?\\b|here\\b|for\\b|from\\b|at\\b|on\\b",
  '|you\\b|your\\b|their\\b|this\\b|that\\b|challenges?\\b|has\\b|have\\b|is\\b|are\\b|moves?\\b|costs?\\b)',
  // "and/or" followed by a verb (not a proper name continuation)
  '|\\s+(?:and|or)\\s+(?:reveal|put|return|play|exert|banish|deal|draw|give|pay|reduce|shuffle|the\\s+[a-z])',
  // Comma boundary (e.g., "named Pete, you may")
  '|,',
].join('');

/** Words that should never be treated as card names (generic game text) */
const GENERIC_WORDS = new Set(['card', 'character', 'item', 'location', 'action']);

/** Fast check for "named" keyword — avoids regex compilation for cards without it */
const HAS_NAMED = /\bnamed\b/i;

/** Pre-compiled regex: captures everything after "named" until a terminator, sentence boundary, close-paren, or end */
const NAMED_PATTERN = new RegExp(
  `\\bnamed\\s+(.+?)(?=(?:\\.\\s(?![A-Z])|\\)|$)|${NAME_TERMINATOR_SOURCE})`,
  'gi',
);

/**
 * Extract all entity names referenced by "named X" patterns in a card's text.
 * Strips Shift text first (handled by Shift Targets rule).
 * Uses a terminator-based approach: captures everything after "named" until
 * hitting a game-mechanic word (in, can, may, etc.), sentence boundary, or end of text.
 * Returns an array of unique referenced names, or empty if none found.
 */
export function getNamedReferences(card: LorcanaCard): string[] {
  if (!card.text || !HAS_NAMED.test(card.text)) return [];

  // Strip Shift parentheticals and normalize newlines
  const cleanText = card.text.replace(SHIFT_PARENTHETICAL, '').replace(/\n/g, ' ');

  const names = new Set<string>();

  // Reset lastIndex for global regex reuse
  NAMED_PATTERN.lastIndex = 0;

  for (const match of cleanText.matchAll(NAMED_PATTERN)) {
    let name = match[1].trim();

    // Strip trailing punctuation (sentence-end periods, commas) but keep internal ones like "Mr."
    name = name.replace(/[.,]+$/, '');

    if (!name) continue;

    // Skip generic game terms (e.g., "the named card, put it into your hand")
    if (GENERIC_WORDS.has(name.toLowerCase())) continue;

    // Handle "both X and Y" pattern (e.g., "named both Chip and Dale")
    if (name.toLowerCase().startsWith('both ')) {
      const bothMatch = name.match(/^both\s+(.+?)\s+and\s+(.+)$/i);
      if (bothMatch) {
        names.add(bothMatch[1].trim());
        names.add(bothMatch[2].trim());
        continue;
      }
    }

    // Handle "X and Y" or "X or Y" where both parts start with uppercase
    const conjMatch = name.match(/^(.+?)\s+(?:and|or)\s+([A-Z].+)$/);
    if (conjMatch && /^[A-Z]/.test(conjMatch[1])) {
      names.add(conjMatch[1].trim());
      names.add(conjMatch[2].trim());
      continue;
    }

    names.add(name);
  }

  return [...names];
}

/**
 * Classify the effect of a named reference for scoring purposes.
 * Returns a tier based on the game effect described in the card text.
 */
export type NamedEffectTier = 'game-winning' | 'strong' | 'moderate' | 'minor' | 'hostile';

export function classifyNamedEffect(card: LorcanaCard): NamedEffectTier {
  if (!card.text) return 'minor';
  const text = card.text.toLowerCase().replace(/\n/g, ' ');

  // Hostile: banish/exert/damage the named character (limit distance to same clause)
  if (/banish.{0,40}named|named.{0,40}banish/.test(text)) return 'hostile';

  // Game-winning: free play, draw multiple, tutor from deck
  if (/play.*for free|for free|play.*without paying/.test(text)) return 'game-winning';
  if (/draw \d+ card|draw cards/.test(text)) return 'game-winning';
  if (/search your deck/.test(text)) return 'game-winning';

  // Strong: cost reduction, keyword grants (Bodyguard, Challenger, Rush, Evasive, Singer)
  if (/costs? \d+ less|cost.*less|cost reduction|pay \d+ .*less/.test(text)) return 'strong';
  if (/gains? (?:bodyguard|challenger|rush|evasive|singer)/.test(text)) return 'strong';
  if (/challenger \+\d/.test(text)) return 'strong';

  // Moderate: stat boosts, lore, Resist, Support
  if (/\+\d+\s*(?:strength|willpower|lore)/.test(text)) return 'moderate';
  if (/gains?\s+\d+ lore/.test(text)) return 'moderate';
  if (/resist \+\d/.test(text)) return 'moderate';
  if (/gains? support/.test(text)) return 'moderate';
  if (/can't be challenged/.test(text)) return 'moderate';

  // Minor: everything else
  return 'minor';
}

/** Map effect tier to numeric score */
export const NAMED_EFFECT_SCORES: Record<NamedEffectTier, number> = {
  'game-winning': 8,
  strong: 7,
  moderate: 6,
  minor: 5,
  hostile: 4,
};

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
