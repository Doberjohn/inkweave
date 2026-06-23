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
 * Normalize card text for regex matching by stripping newlines.
 *
 * Lorcana card text spans multiple lines, and JS regex `.*` does not cross
 * newlines by default — so a phrase like "reveal\na location card" silently
 * fails to match `reveal.*location card`. Always route card-text patterns
 * through this helper so detection and rule-`matches` agree.
 *
 * Returns an empty string when the card has no text, so callers can chain safely.
 */
export function normalizeCardText(card: LorcanaCard): string {
  return (card.text ?? '').replace(/\n/g, ' ');
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

export const LOCATION_PATTERNS = {
  'at-payoff': /while\b.{0,60}at a location|if\b.{0,60}at a location|is at a location/i,
  move: /\bmove\b[^.]{0,40}?\bcharacter[^.]{0,40}?\blocation|to the same location/i,
  'move-exclude': /move.*damage/i,
  // Fires when you PLAY a location (e.g. Elsa - Ice Artisan).
  'play-trigger': /when(?:ever)? you play a location|whenever.*play a location/i,
  // Fires when a character MOVES onto a location (e.g. Taffyta, Goofy) — a payoff
  // for the `move` enabler. Split from play-trigger so the two events score apart.
  'move-trigger': /when(?:ever)?[^.]{0,40}moves? to a location/i,
  'in-play-check': /if you have a location|while you have a.*(location)|for each location/i,
  search: makeSearchPattern('location(?:\\s+cards?)?'),
  buff: /your locations|locations gain|locations get|location.*can't be challenged|location gains? resist/i,
  boost:
    /under.*(?:characters|character) or locations|under.*locations|locations with boost|play a character or location with boost/i,
  'location-ramp':
    /\bless\b.*(?:to )?(?:play|move).*location|\bless\b for.*location|play a location.*(?:from|for free)/i,
  /** Anti-location cards: banish/remove/shuffle locations. Excluded from location-control. */
  'anti-location': /banish (?:chosen |all )(?:item or )?location|shuffle.*location into/i,
  /** Locations that actually benefit from having cards beneath them — used to scope the boost rule. */
  'boost-beneficiary':
    /for each card (?:under|beneath)|cards? (?:from )?(?:under|beneath) (?:this|the) (?:location|card)/i,
} as const;

export type LocationRole =
  | 'at-payoff'
  | 'move'
  | 'play-trigger'
  | 'move-trigger'
  | 'in-play-check'
  | 'search'
  | 'buff'
  | 'boost'
  | 'location-ramp';

/**
 * Get all location roles a card fulfills.
 * Returns empty array for cards with no location interaction.
 */
/**
 * Ordered role detectors (order = role-array order). A data table instead of an
 * if-ladder keeps `getLocationRoles` flat — adding a role is one row, not one
 * more branch. `exclude` (move only) suppresses a false-positive pattern.
 */
const LOCATION_ROLE_DETECTORS: ReadonlyArray<{
  role: LocationRole;
  pattern: RegExp;
  exclude?: RegExp;
}> = [
  {role: 'at-payoff', pattern: LOCATION_PATTERNS['at-payoff']},
  {role: 'move', pattern: LOCATION_PATTERNS.move, exclude: LOCATION_PATTERNS['move-exclude']},
  {role: 'play-trigger', pattern: LOCATION_PATTERNS['play-trigger']},
  {role: 'move-trigger', pattern: LOCATION_PATTERNS['move-trigger']},
  {role: 'in-play-check', pattern: LOCATION_PATTERNS['in-play-check']},
  {role: 'search', pattern: LOCATION_PATTERNS.search},
  {role: 'buff', pattern: LOCATION_PATTERNS.buff},
  {role: 'boost', pattern: LOCATION_PATTERNS.boost},
  {role: 'location-ramp', pattern: LOCATION_PATTERNS['location-ramp']},
];

export function getLocationRoles(card: LorcanaCard): LocationRole[] {
  if (isLocation(card) || !card.text) return [];

  const text = normalizeCardText(card);

  // Anti-location cards (banish/remove locations) are excluded entirely
  if (LOCATION_PATTERNS['anti-location'].test(text)) return [];

  return LOCATION_ROLE_DETECTORS.filter(
    (d) => d.pattern.test(text) && !d.exclude?.test(text),
  ).map((d) => d.role);
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
export type DiscardRole = 'targeted' | 'random' | 'standard' | 'payoff';

/**
 * Enabler patterns — cards that force opponents to lose cards from hand.
 * Covers: forced discard, targeted (reveal+pick), hand-cap, symmetric, and indirect.
 */
/**
 * Targeted: opponent reveals their hand and you/they discard a SPECIFIC card type
 * (song / action / location / non-character). Highest player agency — you pick the type.
 */
const DISCARD_TARGETED_PATTERN =
  /reveals?\s+their\s+hand\s+and\s+discards?\s+(?:a|an)\s+(?:song|action|location|non-character)\s+card\s+of\s+your\s+choice/i;

/**
 * Random: opponent loses cards without choice (luck-based).
 * Includes "discards X cards at random" and "that player discards a card at random".
 */
const DISCARD_RANDOM_PATTERN = /discards\s+(?:a|an|\d+)\s+cards?\s+at\s+random/i;

/**
 * Generic discard patterns — choose-and-discard, hand-cap, symmetric, mass.
 * Match if the card is NOT already classified as targeted or random.
 */
const DISCARD_GENERIC_PATTERNS: RegExp[] = [
  // "each/chosen opponent chooses and discards" + "have opponent choose and discard"
  /(each|chosen)\s+opponents?\s+(chooses?\s+and\s+discards?|reveals?\s+their\s+hand\s+and\s+discards?|discards?)/i,
  /have\s+(each|chosen)\s+opponents?\s+choose\s+and\s+discard/i,
  // Symmetric / indirect: "each/challenging player...discards"
  /(each|challenging)\s+player\s+(?:may\s+)?chooses?\s+and\s+discards?/i,
  // Hand-cap: "more than X cards in their hand...discard"
  /more\s+than\s+\d+\s+cards\s+in\s+their\s+hand.*discard/i,
  // Comparative: "most cards in their hands choose and discard"
  /most\s+cards\s+in\s+their\s+hands?\s+choose\s+and\s+discard/i,
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
  const normalizedText = normalizeCardText(card);
  if (!HAS_DISCARD_KEYWORD.test(normalizedText)) return [];

  const roles: DiscardRole[] = [];

  // Disruption roles are mutually exclusive — check most specific first.
  if (DISCARD_TARGETED_PATTERN.test(normalizedText)) {
    roles.push('targeted');
  } else if (DISCARD_RANDOM_PATTERN.test(normalizedText)) {
    roles.push('random');
  } else if (DISCARD_GENERIC_PATTERNS.some((p) => p.test(normalizedText))) {
    roles.push('standard');
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
// SACRIFICE DETECTION ("Banish Matters")
// ============================================

/**
 * Sacrifice roles (the aristocrats / "Banish Matters" axis):
 * - self-banish: banishes one of YOUR OWN characters on demand (the enabler)
 * - banish-trigger: rewards you when one of your characters is banished (the payoff)
 *
 * The banish combo is self-banish ↔ banish-trigger: the self-banish card banishes your own
 * payoff body whenever you want, turning a banish trigger into a guaranteed engine.
 */
export type SacrificeRole = 'self-banish' | 'banish-trigger';

/**
 * banish-trigger payoff — a GENERAL (any-cause) banish trigger on your own side
 * or on this character itself. The optional `\w+` slot lets tribal triggers
 * ("your other Racer characters is banished") count, since a self-banish can
 * banish a Racer just as well as a generic character.
 */
const SACRIFICE_BANISH_TRIGGER_PATTERN =
  /when(?:ever)?\s+(?:this character|(?:one of\s+)?your(?:\s+other)?(?:\s+\w+)?\s+characters?|a\s+character\s+of\s+yours)\s+(?:is|are|gets?)\s+banished/i;

/**
 * Combat-only recursion ("banished in a challenge, return this card") belongs to
 * the Challenge Matters axis (#371), NOT sacrifice: a self-banish card banishes
 * outside of combat, so it can never trigger an "in a challenge" payoff. Excluding
 * these prevents promising a banish combo the cards cannot actually perform.
 */
const SACRIFICE_IN_CHALLENGE_PATTERN = /banished\s+in\s+a\s+challenge/i;

/**
 * self-banish enabler — banishes one of YOUR OWN characters. The "of yours" /
 * "your characters" gate is what separates a self-banish card from opponent
 * removal ("banish chosen character" alone targets the opponent — pure removal).
 */
const SACRIFICE_SELF_BANISH_PATTERN =
  /banish\s+(?:one of\s+)?(?:your(?:\s+other)?\s+characters?|(?:another\s+)?chosen\s+character\s+of\s+yours)/i;

/** Fast pre-filter: every sacrifice pattern contains the word "banish". */
const HAS_BANISH_KEYWORD = /banish/i;

/**
 * Determine the sacrifice role(s) a card fulfills. A card can be both a self-banish card
 * and a payoff, though none currently are (the two roles live on different cards).
 */
export function getSacrificeRoles(card: LorcanaCard): SacrificeRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!HAS_BANISH_KEYWORD.test(text)) return [];

  const roles: SacrificeRole[] = [];
  if (SACRIFICE_SELF_BANISH_PATTERN.test(text)) {
    roles.push('self-banish');
  }
  if (SACRIFICE_BANISH_TRIGGER_PATTERN.test(text) && !SACRIFICE_IN_CHALLENGE_PATTERN.test(text)) {
    roles.push('banish-trigger');
  }
  return roles;
}

/**
 * Check if a card participates in the sacrifice axis (self-banish or payoff).
 */
export function isSacrificeCard(card: LorcanaCard): boolean {
  return getSacrificeRoles(card).length > 0;
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
const COST_REDUCTION_SELF_PATTERN = /you\s+pay\s+\d+\s+⬡?\s*less\s+⬡?\s*to\s+play\s+this/i;

/**
 * Self-discount via free-play: "play this character for free" — the limit case
 * of self cost reduction (cost = 0). Distinct shape from "you pay N less", but
 * the same mechanic: this character's mana cost is reduced when a condition is met.
 * Strict "this character" qualifier prevents matching grants like
 * "play your next Toy for free".
 */
const SELF_DISCOUNT_FREE_PATTERN = /play\s+this\s+character\s+for\s+free/i;

/** Fast pre-filter: skip cards without any ramp-related keywords */
const HAS_RAMP_KEYWORD = /inkwell|you pay \d+.*less/i;

/**
 * Determine the ramp role(s) a card fulfills.
 * A card can have multiple roles (e.g., a card that both ramps and triggers).
 */
export function getRampRoles(card: LorcanaCard): RampRole[] {
  if (!card.text) return [];
  const t = normalizeCardText(card);
  if (!HAS_RAMP_KEYWORD.test(t)) return [];

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
  const t = normalizeCardText(card);
  return (
    /put\s+the\s+top\s+card\s+of\s+your\s+deck\s+into\s+your\s+inkwell/i.test(t) ||
    /look\s+at\s+the\s+top.*?put.*?into\s+your\s+inkwell/i.test(t) ||
    /put\s+up\s+to\s+\d+\s+cards?\s+from\s+your\s+discard\s+into\s+your\s+inkwell/i.test(t)
  );
}

/**
 * Sub-pattern detection: returns whether a trigger fires every ink event (true)
 * or is capped at once per turn (false).
 */
export function isRepeatingTrigger(card: LorcanaCard): boolean {
  if (!card.text) return false;
  const t = normalizeCardText(card);
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
  const t = normalizeCardText(card);
  if (!COST_REDUCTION_GRANT_PATTERN.test(t) || COST_REDUCTION_SELF_PATTERN.test(t)) return null;

  // Extract the text after "you pay X less"
  const match = t.match(
    /you\s+pay\s+\d+\s+⬡?\s*less\s+(?:for\s+the\s+(?:next|first)\s+|to\s+play\s+)(.{0,60})/i,
  );
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
  const cleanText = normalizeCardText(card).replace(SHIFT_PARENTHETICAL, '');

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
  const text = normalizeCardText(card).toLowerCase();

  // Hostile: banish/exert/damage the named character (limit distance to same clause)
  if (/banish.{0,40}named|named.{0,40}banish/.test(text)) return 'hostile';

  // Game-winning: free play, draw multiple, deck search
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

// ============================================
// TOY TRIBAL DETECTION
// ============================================

/**
 * Detects cards whose text references Toy characters (payoff role).
 * Uses "Toy character[s]" rather than bare "Toy" to skip ability-name false
 * positives (e.g., Buzz Lightyear — On the Way's "WORLD'S GREATEST TOY" name).
 */
const TOY_PAYOFF_PATTERN = /\bToy characters?\b/i;

/** Toy-scoped Search — uses the shared helper with Toy character as target */
const TOY_SEARCH_PATTERN = makeSearchPattern('Toy characters?(?:\\s+cards?)?');

/**
 * Toy-scoped Banish trigger — fires on a Toy banish event.
 * Two targets OR'd: tribal ("when a Toy character is banished") and self
 * ("when this character is banished"). Inside getToyRoles the membership
 * gate ensures self-banish only counts when the carrying card is itself a
 * Toy — so "this character" is structurally equivalent to "a Toy character".
 */
const TOY_BANISH_TRIGGER_TRIBAL_PATTERN = makeBanishTriggerPattern('Toy characters?');
const TOY_BANISH_TRIGGER_SELF_PATTERN = makeBanishTriggerPattern('this character');

/** Generic Draw mechanic — literal "draw a card" / "draw N cards". Used by Toys and the mechanics catalog. */
export const DRAW_PATTERN = /(?:you may )?draws? (?:a|\d+) cards?/i;

/**
 * Roles in the Toy tribal playstyle.
 *
 * Composes with other playstyles' role detection:
 * - 'member' — Toy classification (Toy-specific)
 * - Toy-scoped mechanics: 'search', 'draw', 'banish-trigger', 'self-discount'
 * - Lore Denial roles: 'burn', 'steal'
 * - Discard roles: 'targeted', 'random', 'standard' (Discard's own 'payoff' is excluded —
 *   hand-size advantage is a Discard-playstyle concept, not a Toy concept)
 * - Ramp roles: 'inkwell-ramp', 'inkwell-trigger', 'cost-reduction'
 *
 * The generic 'payoff' fallback was retired once every Toy in the live database
 * mapped onto a specific mechanic. A card can still enter the playstyle without
 * a specific role (via TOY_PAYOFF_PATTERN text reference), but it will only
 * surface in synergy results if some specific mechanic is also detected.
 */
export type ToyRole =
  | 'member'
  | 'search'
  | 'draw'
  | 'banish-trigger'
  | 'self-discount'
  | LoreDenialRole
  | Exclude<DiscardRole, 'payoff'>
  | RampRole;

/** Compose roles from other playstyles' detectors (Lore Denial, Discard, Ramp). */
function composeCrossPlaystyleToyRoles(card: LorcanaCard, roles: ToyRole[]): void {
  for (const r of getLoreDenialRoles(card)) roles.push(r);
  for (const r of getDiscardRoles(card)) {
    if (r !== 'payoff') roles.push(r); // Discard's hand-size payoff is a different concept
  }
  for (const r of getRampRoles(card)) roles.push(r);
}

/** Detect Toy-scoped mechanic roles from card text (search, draw, banish-trigger, self-discount). */
function detectToyScopedRoles(text: string, roles: ToyRole[]): void {
  if (TOY_SEARCH_PATTERN.test(text)) roles.push('search');
  if (DRAW_PATTERN.test(text)) roles.push('draw');
  const isBanishTrigger =
    TOY_BANISH_TRIGGER_TRIBAL_PATTERN.test(text) || TOY_BANISH_TRIGGER_SELF_PATTERN.test(text);
  if (isBanishTrigger) roles.push('banish-trigger');
  const isSelfDiscount =
    COST_REDUCTION_SELF_PATTERN.test(text) || SELF_DISCOUNT_FREE_PATTERN.test(text);
  if (isSelfDiscount) roles.push('self-discount');
}

export function getToyRoles(card: LorcanaCard): ToyRole[] {
  const isMember = hasClassification(card, 'Toy');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isTribePayoff = text !== '' && TOY_PAYOFF_PATTERN.test(text);

  // Not a Toy at all — no playstyle membership, no role composition
  if (!isMember && !isTribePayoff) return [];

  const roles: ToyRole[] = [];
  if (isMember) roles.push('member');
  // Gated above by Toy membership/text so cross-playstyle composition can't promote non-Toy cards.
  composeCrossPlaystyleToyRoles(card, roles);
  detectToyScopedRoles(text, roles);
  return roles;
}

export const isToyCard = (card: LorcanaCard): boolean => getToyRoles(card).length > 0;

// ============================================
// SEVEN DWARFS TRIBAL DETECTION
// ============================================

/**
 * Tribe-payoff gate: text references the Seven Dwarfs tribe. Bare "Seven Dwarfs"
 * is safe — no card in the database *names* an ability "Seven Dwarfs", so there
 * is no caps ability-name false positive (unlike Toy's "WORLD'S GREATEST TOY").
 * Matches all 5 payoff cards; membership itself is a subtype check, not regex.
 */
const DWARFS_PAYOFF_PATTERN = /\bSeven Dwarfs\b/i;

/** Density payoff: a benefit gated on having Seven Dwarfs characters in play. */
const DWARFS_DENSITY_PATTERN = /if you have (?:another |a |an |\d+ or more )?Seven Dwarfs/i;

/** Recruit: cheat a Seven Dwarfs character into play for free (Right Behind You). */
const DWARFS_RECRUIT_PATTERN = /play a Seven Dwarfs character[^.]*for free/i;

/** Return: bounce one of your Seven Dwarfs back to hand for value (Snow White - Merry). */
const DWARFS_RETURN_PATTERN = /return (?:chosen )?(?:a |an )?Seven Dwarfs character/i;

/**
 * Roles in the Seven Dwarfs tribal playstyle (modeled on the Toy rule):
 * - 'member'  — Seven Dwarfs classification (the 14 subtype cards)
 * - 'density' — pays off having Seven Dwarfs in play
 * - 'recruit' — plays a Seven Dwarfs character for free
 * - 'return'  — returns a Seven Dwarfs character to hand for value
 *
 * The "OR Princess" satisfier on the payoff cards is intentionally NOT modeled —
 * Princess density belongs to the (separate) Princesses playstyle. A card enters
 * this playstyle only via the Seven Dwarfs subtype or a Seven Dwarfs text reference.
 */
export type DwarfsRole = 'member' | 'density' | 'recruit' | 'return';

/** Detect Seven-Dwarfs-scoped payoff roles from card text (density, recruit, return). */
function detectDwarfsPayoffRoles(text: string, roles: DwarfsRole[]): void {
  if (DWARFS_DENSITY_PATTERN.test(text)) roles.push('density');
  if (DWARFS_RECRUIT_PATTERN.test(text)) roles.push('recruit');
  if (DWARFS_RETURN_PATTERN.test(text)) roles.push('return');
}

export function getDwarfsRoles(card: LorcanaCard): DwarfsRole[] {
  const isMember = hasClassification(card, 'Seven Dwarfs');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isPayoff = text !== '' && DWARFS_PAYOFF_PATTERN.test(text);

  // Not a Seven Dwarfs card at all — no membership, no payoff reference.
  if (!isMember && !isPayoff) return [];

  const roles: DwarfsRole[] = [];
  if (isMember) roles.push('member');
  detectDwarfsPayoffRoles(text, roles);
  return roles;
}

export const isDwarfsCard = (card: LorcanaCard): boolean => getDwarfsRoles(card).length > 0;

/**
 * A Location qualifies as a boost target only if its text references cards beneath it.
 * Without this gate, every Location pairs with every boost-role support card.
 */
export function isBoostBeneficiaryLocation(card: LorcanaCard): boolean {
  if (!isLocation(card)) return false;
  if (!card.text) return false;
  return LOCATION_PATTERNS['boost-beneficiary'].test(normalizeCardText(card));
}

// ============================================
// LORE DENIAL DETECTION
// ============================================

/** Cards that directly make the opponent lose lore (any form — burn or steal) */
export const LORE_LOSS_PATTERN = /(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i;

/**
 * Lore Steal patterns — opponent loses lore AND you gain lore from the same effect.
 * Three structural shapes cover the canonical Lorcana phrasings:
 *   1. "loses X lore and you gain X lore"  (single sentence, conjoined)
 *   2. "loses X lore. (You )?Gain X lore"  (separate sentences)
 *   3. "gain lore equal to (the )?lore lost"  (variable transfer)
 * Cards matching any → Steal role; cards matching only LORE_LOSS_PATTERN → Burn role.
 */
const LORE_STEAL_PATTERNS: RegExp[] = [
  /loses?\s+\d+\s+lore\s+and\s+you\s+gain\s+\d+\s+lore/i,
  /loses?\s+\d+\s+lore\.\s*(?:you\s+)?gain\s+\d+\s+lore/i,
  /gain\s+lore\s+equal\s+to\s+(?:the\s+)?lore\s+lost/i,
];

export type LoreDenialRole = 'burn' | 'steal';

/**
 * Determine the lore-denial role(s) a card fulfills.
 * Returns ['steal'] if a transfer pattern matches, ['burn'] if only the bare lore-loss matches, [] otherwise.
 * Burn and Steal are mutually exclusive — a card is one or the other.
 */
export function getLoreDenialRoles(card: LorcanaCard): LoreDenialRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!LORE_LOSS_PATTERN.test(text)) return [];
  if (LORE_STEAL_PATTERNS.some((p) => p.test(text))) return ['steal'];
  return ['burn'];
}

export const isLoreDenialCard = (card: LorcanaCard): boolean => getLoreDenialRoles(card).length > 0;
