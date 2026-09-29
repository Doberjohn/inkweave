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
 * Typographic single quotes (U+2018, U+2019). Reveal-season preview text prints them
 * ("can’t", "player’s"), while LorcanaJSON text and every engine pattern use the straight '.
 * Global flag: use it with .replace only, since a /g regex's .test() keeps lastIndex state.
 */
const TYPOGRAPHIC_APOSTROPHE = /[‘’]/g;

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
export function normalizeCardText(card: LorcanaCard): string {
  return (card.text ?? '').replace(/\n/g, ' ').replace(TYPOGRAPHIC_APOSTROPHE, "'");
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
// SELF-DISCARD DETECTION (fill your own discard, then cash it)
// ============================================

/**
 * Self-Discard is the player-side mirror of the opponent-facing Discard rule (Rule 4):
 * you fill your OWN discard, then benefit. Five roles:
 *  - 'enabler'      — a hand-discard outlet (loot, discard-your-hand, discard-as-cost)
 *  - 'mill'         — fills the bin from the DECK ("put the top N cards of your deck into your
 *                     discard"). A bin-filler for zone payoffs and reanimators, never a
 *                     hand-discard enabler: it does not trigger a "when you discard" payoff.
 *  - 'reanimator'   — plays / returns a card FROM YOUR DISCARD (recursion). `makeSearchPattern`
 *                     deliberately excludes "from your discard" and defers recursion to this role.
 *  - 'state-payoff' — rewards the discard EVENT ("discarded a card this turn") or an empty hand.
 *  - 'zone-payoff'  — rewards the discard as a countable ZONE ("10 or more cards in your discard",
 *                     "a song card in your discard", "cards were put into your discard this turn").
 *
 * The opponent-exclusion keeps the enabler disjoint from the Discard rule. Songs are not
 * bin-fillers here: a sung song lands in the discard, but that is the Singer rule's axis.
 */
export type SelfDiscardRole = 'enabler' | 'reanimator' | 'state-payoff' | 'zone-payoff' | 'mill';

/** Loot — "draw a card, then choose and discard a card": the dominant self-discard outlet. */
const SELF_DISCARD_LOOT_PATTERN = /draw\s+(?:a|an|\d+)\s+cards?,?\s+then\s+(?:choose and\s+)?discard/i;
/** Discard-your-hand — a full hand dump (e.g. dump the hand, draw N). */
const SELF_DISCARD_HAND_PATTERN = /discard\s+your\s+hand/i;
/**
 * Discard-as-cost — kept tight (≤2 words between "discard a" and "card") so it catches generic
 * "discard a card" costs without over-tagging narrow conditional costs like a Princess/Queen discard.
 */
const SELF_DISCARD_COST_PATTERN = /(?:you may\s+)?discard\s+(?:a|an|another|\d+)\s+(?:\w+\s+){0,2}?cards?\b/i;
/** Opponent-facing discard belongs to the Discard rule; exclude it here to keep the two axes disjoint. */
const SELF_DISCARD_OPPONENT_PATTERN = /opponent|each player|challenging player|that player/i;

/** Reanimator — play / return / put a card FROM YOUR DISCARD (recursion payoff). */
const SELF_DISCARD_REANIMATOR_PATTERN = /(?:play|return|put)\b[^.]{0,60}\bfrom your discard\b/i;
/**
 * Recursion that can only ever return the card itself or a card it just handled
 * ("return this card from your discard", "a song card you played this turn … from your
 * discard", "If you discarded a location card this way, you may play it from your discard").
 * No hand-discard or mill enabler feeds it, so its sentence is stripped before the reanimator test.
 */
const SELF_CONTAINED_RECURSION_PATTERN =
  /\b(?:this|that)\s+(?:card|item|character|location)\b[^.]{0,20}\bfrom your discard\b|\bthose\s+characters\s+from your discard\b|\byou played this turn\b[^.]{0,60}\bfrom your discard\b|\bthis way, you may (?:play|return) it from your discard\b/i;
/** Self-recursion that fires when YOU discard the card is fed by hand discard, so it stays. */
const DISCARD_FED_RECURSION_PATTERN = /\bwhen(?:ever)?\s+you\s+discard\b/i;

/** The text without its self-contained recursion sentences (see SELF_CONTAINED_RECURSION_PATTERN). */
function stripSelfContainedRecursion(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !(SELF_CONTAINED_RECURSION_PATTERN.test(s) && !DISCARD_FED_RECURSION_PATTERN.test(s)))
    .join(' ');
}
/** State payoff, event half: rewards the discard EVENT ("if you discarded a card this turn"). */
const SELF_DISCARD_EVENT_PATTERN = /discarded\s+a\s+card\s+this\s+turn/i;
/** State payoff, empty-hand half: rewards an empty hand ("while you have no cards in your hand"). */
const SELF_DISCARD_HELLBENT_PATTERN = /no cards in (?:your )?hand/i;
/**
 * Zone payoff — counts or checks cards sitting IN your discard ("10 or more cards in your
 * discard", "for each Alien character card in your discard", "a song card in your discard").
 * "in your discard" keeps it disjoint from the reanimator's "from your discard".
 */
const SELF_DISCARD_ZONE_IN_PATTERN =
  /\b(?:a|an|\d+\s+or\s+more|for\s+each)\s+(?:\w+\s+){0,3}?cards?\s+(?:named\s+\w+\s+)?in\s+your\s+discard\b/i;
/** Zone payoff — the "N or more cards were put into your discard this turn" trigger family. */
const SELF_DISCARD_ZONE_PUT_PATTERN = /cards?\s+were\s+put\s+into\s+your\s+discard\s+this\s+turn/i;
/** Mill — fills the bin from the top of the deck. Kept tight: "put the rest / put it into your discard" is not mill. */
const SELF_DISCARD_MILL_PATTERN =
  /put\s+the\s+top\s+(?:card|\d+\s+cards)\s+of\s+your\s+deck\s+into\s+your\s+discard/i;

/** Fast pre-filter: every self-discard pattern contains "discard" or "no cards in". */
const HAS_SELF_DISCARD_KEYWORD = /discard|no cards in/i;

/** Zone payoff: either the "in your discard" count/check shape or the "put into your discard this turn" trigger. */
function isSelfDiscardZonePayoff(text: string): boolean {
  return SELF_DISCARD_ZONE_IN_PATTERN.test(text) || SELF_DISCARD_ZONE_PUT_PATTERN.test(text);
}

/** State payoff: the discard event ("discarded a card this turn") or an empty hand. */
function isSelfDiscardStatePayoff(text: string): boolean {
  return SELF_DISCARD_EVENT_PATTERN.test(text) || SELF_DISCARD_HELLBENT_PATTERN.test(text);
}

/**
 * Enabler: a hand-discard OUTLET (loot / discard-your-hand / discard-as-cost) that is NOT
 * opponent-facing (opponent discard belongs to the Discard rule). Split out of
 * getSelfDiscardRoles so the role builder stays a flat sequence of named pushes.
 */
function isSelfDiscardEnabler(text: string): boolean {
  const isOutlet =
    SELF_DISCARD_LOOT_PATTERN.test(text) ||
    SELF_DISCARD_HAND_PATTERN.test(text) ||
    SELF_DISCARD_COST_PATTERN.test(text);
  return isOutlet && !SELF_DISCARD_OPPONENT_PATTERN.test(text);
}

/** Determine the self-discard role(s) a card fulfills. A card can be multi-role (loot + reanimate). */
export function getSelfDiscardRoles(card: LorcanaCard): SelfDiscardRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!HAS_SELF_DISCARD_KEYWORD.test(text)) return [];

  const roles: SelfDiscardRole[] = [];
  if (isSelfDiscardEnabler(text)) roles.push('enabler');
  if (SELF_DISCARD_REANIMATOR_PATTERN.test(stripSelfContainedRecursion(text))) roles.push('reanimator');
  if (isSelfDiscardStatePayoff(text)) roles.push('state-payoff');
  if (isSelfDiscardZonePayoff(text)) roles.push('zone-payoff');
  if (SELF_DISCARD_MILL_PATTERN.test(text)) roles.push('mill');
  return roles;
}

/** Check if a card participates in the self-discard axis (any of the five roles). */
export function isSelfDiscardCard(card: LorcanaCard): boolean {
  return getSelfDiscardRoles(card).length > 0;
}

// --------------------------------------------
// Self-discard feed check: can this outlet's discard switch on that payoff?
// --------------------------------------------

/** A card kind a typed discard or recursion clause names. A song is an action (CR 5.4.4.1). */
type SelfDiscardKind = 'character' | 'action' | 'song' | 'item' | 'location';

/** Kind word → the kinds it admits. "action" admits songs too; "song" admits only songs. */
const SELF_DISCARD_KIND_WORDS: ReadonlyArray<readonly [RegExp, readonly SelfDiscardKind[]]> = [
  [/\bsongs?\b/i, ['song']],
  [/\bactions?\b/i, ['action', 'song']],
  [/\bcharacters?\b/i, ['character']],
  [/\bitems?\b/i, ['item']],
  [/\blocations?\b/i, ['location']],
];
/** An outlet that can discard any card: a generic "discard a card" (loot, cost) or the whole hand. */
const SELF_DISCARD_ANY_OUTLET_PATTERN = /discard\s+(?:a|an|another|\d+)\s+cards?\b|discard\s+your\s+hand/i;
/** A typed outlet: "discard a song card", "discard an Alien character card or a location card". */
const SELF_DISCARD_TYPED_OUTLET_PATTERN =
  /discard\s+an?\s+(?:\w+\s+){1,2}?cards?(?:\s+or\s+an?\s+(?:\w+\s+){1,2}?cards?)?/i;
/** A recursion clause's object: the words between its nearest play/return/put and "from your discard". */
const SELF_DISCARD_RECURSION_OBJECT_PATTERN =
  /\b(?:play|return|put)\b((?:(?!\b(?:play|return|put)\b)[^.]){0,60}?)\bfrom your discard\b/i;
/** A recursion object restricted to one named card: "an action card named Three Arrows". */
const SELF_DISCARD_NAMED_OBJECT_PATTERN = /\bnamed\s+(.+?)\s*$/i;
/** A recursion object that takes any card: "a card", "another card", "2 cards". */
const SELF_DISCARD_ANY_OBJECT_PATTERN = /\b(?:a|an|another|any|\d+)\s+cards?\b/i;
/**
 * An outlet that discards one card and then draws 2+ ("discard a song card. If you do, draw
 * 2 cards"), so its hand is never empty when it resolves. Deliberately narrow (Max Goof -
 * Karaoke Star only today); general empty-hand scoring is a separate decision.
 */
const SELF_DISCARD_REFILL_PATTERN =
  /discard\s+an?\s+(?:\w+\s+){0,2}?card\.\s*if you do,\s*draw\s+[2-9]\s+cards/i;

/** The kinds the kind words in `fragment` admit (empty when it names none). */
function selfDiscardKindsIn(fragment: string): Set<SelfDiscardKind> {
  const kinds = new Set<SelfDiscardKind>();
  for (const [word, admits] of SELF_DISCARD_KIND_WORDS) {
    if (word.test(fragment)) admits.forEach((kind) => kinds.add(kind));
  }
  return kinds;
}

/** What an outlet can put in the bin; null when it can discard any card (or names no known kind). */
function selfDiscardOutletKinds(text: string): Set<SelfDiscardKind> | null {
  if (SELF_DISCARD_ANY_OUTLET_PATTERN.test(text)) return null;
  const kinds = selfDiscardKindsIn(SELF_DISCARD_TYPED_OUTLET_PATTERN.exec(text)?.[0] ?? '');
  return kinds.size > 0 ? kinds : null;
}

/** A self-reference ("this card", "it", a card named like itself) recurs the card's own kind. */
function ownSelfDiscardKinds(card: LorcanaCard): Set<SelfDiscardKind> {
  return new Set([isSong(card) ? 'song' : (card.type.toLowerCase() as SelfDiscardKind)]);
}

/**
 * What a reanimator pulls from the bin; null when it takes any card. A named other card
 * ("an action card named Three Arrows") admits no kind, since no typed outlet is known to
 * discard it; an object with no kind word and no generic card ("this card", "it") is a self-reference.
 */
function selfDiscardRecursionKinds(card: LorcanaCard, text: string): Set<SelfDiscardKind> | null {
  const object = SELF_DISCARD_RECURSION_OBJECT_PATTERN.exec(text)?.[1] ?? 'a card';
  const named = SELF_DISCARD_NAMED_OBJECT_PATTERN.exec(object)?.[1];
  if (named !== undefined) return named === card.name ? ownSelfDiscardKinds(card) : new Set();
  const kinds = selfDiscardKindsIn(object);
  if (kinds.size > 0) return kinds;
  return SELF_DISCARD_ANY_OBJECT_PATTERN.test(object) ? null : ownSelfDiscardKinds(card);
}

/** Two kind sets can meet in one card: either side takes any card, or they share a kind. */
function selfDiscardKindsMeet(a: Set<SelfDiscardKind> | null, b: Set<SelfDiscardKind> | null): boolean {
  return a === null || b === null || [...a].some((kind) => b.has(kind));
}

/**
 * Whether `enabler`'s hand discard can switch on `payoff`'s reanimator or state payoff:
 *  - recursion: the outlet's discard kinds meet the recursion kinds, so a typed outlet ("discard
 *    a song card") feeds song, action and any-card recursion, never character or item recursion;
 *  - state: any discard is a "discarded a card this turn" event, but a refill outlet never
 *    leaves the empty hand a "no cards in hand" payoff needs.
 * Reads the payoff's text with self-contained recursion stripped, like getSelfDiscardRoles.
 */
export function selfDiscardOutletFeeds(
  enabler: LorcanaCard,
  payoff: LorcanaCard,
  payoffRoles: SelfDiscardRole[],
): boolean {
  const outletText = normalizeCardText(enabler);
  const payoffText = normalizeCardText(payoff);
  const feedsRecursion =
    payoffRoles.includes('reanimator') &&
    selfDiscardKindsMeet(
      selfDiscardOutletKinds(outletText),
      selfDiscardRecursionKinds(payoff, stripSelfContainedRecursion(payoffText)),
    );
  const feedsState =
    payoffRoles.includes('state-payoff') &&
    (SELF_DISCARD_EVENT_PATTERN.test(payoffText) || !SELF_DISCARD_REFILL_PATTERN.test(outletText));
  return feedsRecursion || feedsState;
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

/**
 * A Shift reminder, whatever its cost: "(You may pay 5 ⬡ to play this on top of one of your
 * characters named Elsa.)", "(You may remove 2 ink drops to play this on top of ...)". Its
 * "named X" is a Shift target, which Shift Targets handles, so getNamedReferences strips it.
 * Keyed on the reminder's wording, not the keyword, so any cost shape is stripped.
 */
const SHIFT_REMINDER = /\([^)]*\bto play this on top of\b[^)]*\)/gi;

/**
 * A sentence end followed by an ALL-CAPS word: the title of the card's next ability, as in
 * "not named Mor'du. ROOTED BY FEAR". Case-sensitive on purpose: NAMED_PATTERN's 'i' flag
 * makes its [A-Z] match any letter, so it cannot tell this title from the "Smee" in
 * "Mr. Smee". A lone initial ("P. J. Pete") is not a title. getNamedReferences scans the
 * text between two titles on its own, so a name ends where the next ability begins.
 */
const ABILITY_TITLE_START = /\.\s+(?![A-Z]\.\s)(?=[^\sa-z]*[A-Z][^\sa-z]*(?:\s|$))/;

/**
 * Game-mechanic terminator pattern (as regex source string) that signals the
 * end of a card name. Names can contain lowercase articles ("the", "of"),
 * periods ("Mr."), hyphens ("Fix-It"), and exclamation marks ("Pull the
 * Lever!"), so we stop at words that clearly belong to game rules text.
 *
 * Also terminates on comma (handles "named Pete, you may..."), and on "and/or"
 * followed by a game verb or by a generic card description ("named Kevin or an
 * item card"), neither of which continues a name.
 */
const NAME_TERMINATOR_SOURCE = [
  // Game-mechanic verbs and prepositions
  "\\s+(?:in\\b|can\\b|can't\\b|may\\b|gets?\\b|gains?\\b|here\\b|for\\b|from\\b|at\\b|on\\b",
  '|you\\b|your\\b|their\\b|this\\b|that\\b|challenges?\\b|has\\b|have\\b|is\\b|are\\b',
  '|was\\b|were\\b|moves?\\b|costs?\\b)',
  // "and/or" followed by a verb (not a proper name continuation)
  '|\\s+(?:and|or)\\s+(?:reveal|put|return|play|exert|banish|deal|draw|give|pay|reduce|shuffle|the\\s+[a-z])',
  // "and/or" followed by a generic card description, not a second name ("or an item card")
  '|\\s+(?:and|or)\\s+(?:an?|another)\\s+(?:[a-z]+\\s+)?(?:card|character|item|location|action)s?\\b',
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
 * hitting a game-mechanic word (in, can, may, etc.), sentence boundary, ability
 * title, or end of text.
 * Returns an array of unique referenced names, or empty if none found.
 */
export function getNamedReferences(card: LorcanaCard): string[] {
  if (!card.text || !HAS_NAMED.test(card.text)) return [];

  // Strip Shift reminders (normalizeCardText already spells apostrophes as card names do)
  const cleanText = normalizeCardText(card).replace(SHIFT_REMINDER, '');

  const names = new Set<string>();

  // Reset lastIndex for global regex reuse
  NAMED_PATTERN.lastIndex = 0;

  // Scan the text between ability titles piece by piece, so a name never runs into a title
  const matches = cleanText
    .split(ABILITY_TITLE_START)
    .flatMap((piece) => [...piece.matchAll(NAMED_PATTERN)]);

  for (const match of matches) {
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

/** Effect tier of a named reference; NAMED_EFFECT_SCORES maps each tier to its score. */
export type NamedEffectTier = 'game-winning' | 'strong' | 'moderate' | 'minor' | 'hostile';

/**
 * Classify the effect of a named reference for scoring purposes.
 * Returns a tier based on the game effect described in the card text.
 */
export function classifyNamedEffect(card: LorcanaCard): NamedEffectTier {
  if (!card.text) return 'minor';
  const text = normalizeCardText(card).toLowerCase();

  // Hostile: a "banish" within 40 characters of "named" (the same clause), read as the card
  // banishing the named character. A passive "banished" does not count: "named Buzz Lightyear
  // was banished" is a condition the card waits for, not an attack.
  if (/banish(?!ed).{0,40}named|named.{0,40}banish(?!ed)/.test(text)) return 'hostile';

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

// ============================================
// MERIDA - WISP CONJURER (BECKON) DETECTION
// ============================================

/**
 * Single-anchor direct rule built around **Merida - Wisp Conjurer** (Amethyst, id 13050).
 * Her BECKON ability draws a card "whenever ANOTHER character of yours enters play exerted",
 * so she synergizes with cards that push YOUR characters into play exerted. Modeled on the
 * Spike Suit rule (one card defines the synergy; matched on ability text, not a card id, so a
 * reprint joins for free).
 *
 * Enabler tiers, scored by how much exerted-entry pressure the card generates:
 * - 'engine'     (8) — board-wide / repeatable: pushes OTHER of your characters into play
 *                      exerted. "...they enter play exerted" (Horned King, Simba) or the item
 *                      "the next character you play this turn enters play exerted"
 *                      (Powhatan's Staff). Fires BECKON many times per game.
 * - 'reanimator' (7) — replays ITSELF exerted from your discard ("if this card is in your
 *                      discard ... she/he enters play exerted" — Lilo, Stitch). One repeatable
 *                      exerted entry per loop.
 * - 'self'       (5) — a self-only body that "enters play exerted" once when played (the
 *                      Bodyguard reminder "This character may enter play exerted", plus a few
 *                      explicit bodies). Parallel density: fires BECKON exactly once.
 */
export type BeckonEnablerTier = 'engine' | 'reanimator' | 'self';

/** Fast pre-filter: every BECKON card mentions entering play exerted. */
const BECKON_HAS_EXERT = /enters? play exerted/i;

/**
 * Anchor: Merida's BECKON reward, matched on ability text so a reprint joins automatically.
 * The "another character of yours" wording is what excludes her own FOCUSED ENERGY self-exert
 * ("This character may enter play exerted") from triggering the draw.
 */
const BECKON_ANCHOR_PATTERN = /whenever another character of yours enters play exerted/i;

/**
 * Opposing-side exclusion: cards that make the OPPONENT's characters enter play exerted are
 * removal/tempo, not a BECKON enabler (BECKON fires only on YOUR characters). e.g. Jiminy
 * Cricket ("opposing characters with Rush enter play exerted").
 */
const BECKON_OPPOSING_PATTERN = /opposing[^.]{0,40}enters? play exerted/i;

/**
 * Engine: pushes OTHER of your characters into play exerted, repeatably.
 * - "...they enter play exerted" — playing characters from your discard / a revealed character
 *   (Horned King, Simba).
 * - "the next character you play this turn enters play exerted" — an ITEM (Powhatan's Staff)
 *   that shoves the next character in exerted; admitted even though it isn't a character
 *   (the Shift named-item exception: an item can still push a CHARACTER into exerted).
 */
const BECKON_ENGINE_PATTERN =
  /they enter play exerted|the next character you play[^.]{0,80}enters? play exerted/i;

/** Reanimator: this card replays ITSELF exerted from your discard (Lilo, Stitch). */
const BECKON_REANIMATOR_PATTERN =
  /(?:this card is in your discard|from your discard)[^.]{0,140}(?:he|she|it|they|this character) enters? play exerted/i;

/** Self-only body: "this character (may) enters play exerted" (incl. the Bodyguard reminder). */
const BECKON_SELF_PATTERN = /this character (?:may )?enters? play exerted/i;

/** True for the BECKON anchor (Merida - Wisp Conjurer or a same-text reprint). */
export function isBeckonAnchor(card: LorcanaCard): boolean {
  return card.text != null && BECKON_ANCHOR_PATTERN.test(normalizeCardText(card));
}

/**
 * A card is excluded from the BECKON enabler tiers when it is the anchor itself (Merida's own
 * FOCUSED ENERGY self-exert is "another character", so she can't self-pair) or when the exert
 * lands on an OPPOSING character (removal, not an enabler). Split out of getBeckonEnablerTier
 * so the tier classifier stays a flat reject → tier sequence.
 */
function isBeckonEnablerExcluded(card: LorcanaCard, t: string): boolean {
  return isBeckonAnchor(card) || BECKON_OPPOSING_PATTERN.test(t);
}

/**
 * Classify a card's BECKON enabler tier, or null if it doesn't push YOUR characters into play
 * exerted. Order is load-bearing:
 *   1. anchor self-check — Merida's own self-exert (FOCUSED ENERGY) never counts as an enabler
 *      ("another character"), so she can't self-pair.
 *   2. opposing exclusion — opponent-side exerts are removal, not an enabler.
 *   3. reanimator → engine → self.
 * The `self` branch is gated on isCharacter so an ITEM reading "this item enters play exerted"
 * (Sapphire Chromicon, MegaBot, Potato, ...) drops out — it's a character-only trigger. Powhatan's
 * Staff (an item) is still admitted, but via the engine branch, because it makes a CHARACTER exerted.
 */
export function getBeckonEnablerTier(card: LorcanaCard): BeckonEnablerTier | null {
  if (card.text == null) return null;
  const t = normalizeCardText(card);
  if (!BECKON_HAS_EXERT.test(t)) return null;
  if (isBeckonEnablerExcluded(card, t)) return null;
  if (BECKON_REANIMATOR_PATTERN.test(t)) return 'reanimator';
  if (BECKON_ENGINE_PATTERN.test(t)) return 'engine';
  if (BECKON_SELF_PATTERN.test(t) && isCharacter(card)) return 'self';
  return null;
}

/** True for any card that participates in the BECKON rule (the anchor or an enabler). */
export const isBeckonEnabler = (card: LorcanaCard): boolean => getBeckonEnablerTier(card) !== null;

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

// ============================================
// FLOODBORNS DETECTION (Floodborn Matters, payoff-anchored)
// ============================================

/**
 * The "Floodborns" archetype is branded for the new Set 13 Vineling classification,
 * but its membership and payoffs key on the broader **Floodborn** classification:
 * every payoff card reads "your Floodborn characters". So a `member` is any Floodborn
 * character (114+ across all sets), and `isFloodbornCard` returns true for any Floodborn
 * character or Floodborn-matters payoff, NOT only the Vineling subtype.
 *
 * Roles:
 * - 'member'  — a Floodborn character (the body the payoffs reward)
 * - 'buff'    — a static team pump: "your [...] Floodborn characters get/gain ..."
 * - 'trigger' — a repeating engine: "whenever [...] Floodborn ..." (quest / play / banish)
 *
 * Payoff-anchored: the rule (see rules.ts) does not pair two plain members with each
 * other, so 'member' alone never produces a synergy without a 'buff'/'trigger' partner.
 */
export type FloodbornRole = 'member' | 'buff' | 'trigger';

/** Static team buff: "Your [...] Floodborn characters get/gain ...". */
const FLOODBORN_BUFF_PATTERN = /your\b[^.]*\bfloodborn characters?\b[^.]*\b(?:get|gain)\b/i;
/** Repeating trigger: "whenever [...] Floodborn ..." (quests / is banished / you play another). */
const FLOODBORN_TRIGGER_PATTERN = /\bwhen(?:ever)?\b[^.]*\bfloodborn\b/i;

/** Detect Floodborn-matters payoff roles from card text (buff, trigger). */
function detectFloodbornPayoffRoles(text: string, roles: FloodbornRole[]): void {
  if (FLOODBORN_BUFF_PATTERN.test(text)) roles.push('buff');
  if (FLOODBORN_TRIGGER_PATTERN.test(text)) roles.push('trigger');
}

export function getFloodbornRoles(card: LorcanaCard): FloodbornRole[] {
  const text = card.text != null ? normalizeCardText(card) : '';
  const roles: FloodbornRole[] = [];
  if (isCharacter(card) && hasClassification(card, 'Floodborn')) roles.push('member');
  detectFloodbornPayoffRoles(text, roles);
  return roles;
}

export const isFloodbornCard = (card: LorcanaCard): boolean => getFloodbornRoles(card).length > 0;

// ============================================
// HUNNY TRIBAL DETECTION
// ============================================

/**
 * Hunny tribe (Winnie-the-Pooh, Set 13). Membership is the Hunny classification.
 * The payoff gate is "Hunny (character|card|classification)" and deliberately NOT
 * bare "Hunny", because abilities are named "HUNNY AURA" / "HUNNY ACTIVATION"
 * (the same caps-ability-name trap as Toy's "WORLD'S GREATEST TOY").
 *
 * Roles: 'member', 'density' (gated on Hunny in play), 'search' (dig a Hunny from deck),
 * 'buff' (single-target pump of a chosen Hunny).
 */
export type HunnyRole = 'member' | 'density' | 'search' | 'buff';

const HUNNY_PAYOFF_PATTERN = /\bHunny (?:character|card|classification)/i;
const HUNNY_DENSITY_PATTERN = /(?:\d+ or more other|another|your other)\s+Hunny characters?/i;
const HUNNY_SEARCH_PATTERN = /search your deck for a Hunny card|Hunny card[^.]*put it into your hand/i;
const HUNNY_BUFF_PATTERN = /chosen Hunny character/i;

/** Detect Hunny-scoped payoff roles from card text (density, search, buff). */
function detectHunnyPayoffRoles(text: string, roles: HunnyRole[]): void {
  if (HUNNY_DENSITY_PATTERN.test(text)) roles.push('density');
  if (HUNNY_SEARCH_PATTERN.test(text)) roles.push('search');
  if (HUNNY_BUFF_PATTERN.test(text)) roles.push('buff');
}

export function getHunnyRoles(card: LorcanaCard): HunnyRole[] {
  const isMember = hasClassification(card, 'Hunny');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isPayoff = text !== '' && HUNNY_PAYOFF_PATTERN.test(text);
  if (!isMember && !isPayoff) return [];

  const roles: HunnyRole[] = [];
  if (isMember) roles.push('member');
  detectHunnyPayoffRoles(text, roles);
  return roles;
}

export const isHunnyCard = (card: LorcanaCard): boolean => getHunnyRoles(card).length > 0;

// ============================================
// RED PANDA TRIBAL DETECTION
// ============================================

/**
 * Red Panda tribe (Turning Red, Set 13). Membership is the Red Panda classification.
 * The lone tribal payoff is a deck search; the pattern matches the search shape
 * ("reveal a Red Panda character"), NOT bare "Red Panda character", so Sun Yee's
 * Temporary Red Panda Shift reminder text ("on top of one of your Red Panda characters")
 * does not false-positive.
 */
export type RedPandaRole = 'member' | 'search';

const RED_PANDA_SEARCH_PATTERN = /reveal a Red Panda character/i;

export function getRedPandaRoles(card: LorcanaCard): RedPandaRole[] {
  const isMember = hasClassification(card, 'Red Panda');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isSearch = text !== '' && RED_PANDA_SEARCH_PATTERN.test(text);

  if (!isMember && !isSearch) return [];

  const roles: RedPandaRole[] = [];
  if (isMember) roles.push('member');
  if (isSearch) roles.push('search');
  return roles;
}

export const isRedPandaCard = (card: LorcanaCard): boolean => getRedPandaRoles(card).length > 0;

// ============================================
// ITEM MATTERS ("Items" playstyle)
// ============================================

/**
 * Item Matters roles (the Set 9-13 Inventor / artifacts axis). PAYOFF-ANCHORED like
 * Floodborn: item members synergize with payoffs, never with each other, so the
 * rule's `findSynergies` skips member↔member to avoid ~3,000 density pairs across the
 * 82-item pool.
 *
 * - `member` — any Item card (the thing that gets played).
 * - `payoff-trigger` — a repeating "whenever you play an item" reward.
 * - `payoff-static` — a conditional/count reward ("for each item", "while/if you have an item in play").
 * - `item-engine` — tutor/search items, return items from discard, or discount OTHER items.
 *
 * EXCLUDES item removal ("banish chosen item") — anti-item control on the opposite
 * axis, which never matches the play/return/for-each patterns below. Role ids are
 * item-specific ("item-engine") to avoid colliding with other rules' catalog labels.
 */
export type ItemRole = 'member' | 'item-engine' | 'payoff-trigger' | 'payoff-static';

const ITEM_PLAY_TRIGGER = /whenever you play an item/i;
const ITEM_STATIC_PAYOFF =
  /for each (?:of your )?items?\b|(?:while|if) you have (?:an?|\d+ or more) items?(?!\s+named)(?: in play)?|each item you have in play|\bready chosen item\b/i;
/** Search/tutor/free-play an item from deck, hand, or discard. */
const ITEM_SEARCH =
  /reveal[^.]{0,40}\bitem card|\bplay (?:a|an|that|chosen)[^.]{0,30}\bitem\b[^.]{0,30}(?:for free|from your (?:hand|discard))/i;
/** Return an item card from your discard. */
const ITEM_RECURSION = /\bitem card[^.]{0,30}from your discard|from your discard[^.]{0,15}\bitem card/i;
/** Discount an item you play (gated below so self-discount "this item" doesn't count). */
const ITEM_COST_REDUCTION = /pay \d+[^.]{0,5}(?:less|fewer)[^.]{0,28}\bitems?\b/i;
const SELF_ITEM_DISCOUNT = /(?:less|fewer)[^.]{0,12}to play this item/i;
const HAS_ITEM_KEYWORD = /\bitem/i;

/**
 * An item engine tutors/searches items, returns items from discard, or discounts OTHER
 * items. The cost-reduction branch is gated so a self-discount ("this item") stays a plain
 * member. Split out of getItemRoles so the role builder reads as a flat sequence of pushes.
 */
function isItemEngine(text: string): boolean {
  return (
    ITEM_SEARCH.test(text) ||
    ITEM_RECURSION.test(text) ||
    (ITEM_COST_REDUCTION.test(text) && !SELF_ITEM_DISCOUNT.test(text))
  );
}

/** Determine the Item-Matters role(s) a card fulfills. A card can be multi-role. */
export function getItemRoles(card: LorcanaCard): ItemRole[] {
  const roles: ItemRole[] = [];
  if (card.type === 'Item') roles.push('member');

  if (card.text == null) return roles;
  const text = normalizeCardText(card);
  if (!HAS_ITEM_KEYWORD.test(text)) return roles;

  if (ITEM_PLAY_TRIGGER.test(text)) roles.push('payoff-trigger');
  if (ITEM_STATIC_PAYOFF.test(text)) roles.push('payoff-static');
  if (isItemEngine(text)) roles.push('item-engine');

  return roles;
}

export const isItemCard = (card: LorcanaCard): boolean => getItemRoles(card).length > 0;

// ============================================
// HEAL MATTERS DETECTION ("Heal Matters", payoff-anchored)
// ============================================

/**
 * The Heal Matters axis: remove damage from your OWN characters, then cash in the
 * payoffs that reward the removal. NOT a Madrigal tribe — only ~12% of healers carry
 * the Madrigal classification and every payoff is worded generically ("remove damage
 * from one of your characters"), so the rule keys on the mechanic, not a subtype.
 *
 * Two roles (enabler -> payoff, mirroring Sacrifice / Discard):
 *  - 'healer'      — an OUTLET that removes damage from a character (the enabler).
 *  - 'heal-payoff' — a benefit gated on the removal event (the payoff).
 *
 * Payoff-anchored: the rule (see rules.ts) pairs a healer only with a payoff, never
 * two plain healers, so 'healer' alone never produces a synergy without a payoff partner.
 */
export type HealRole = 'healer' | 'heal-payoff';

/** Healer (enabler): an outlet that removes damage from a character. Begins with "remove", so a
 *  "move ... damage" clause on the same card can never fabricate a false healer here. */
const HEALER_PATTERN = /remove (?:up to \d+|all|\d+) damage from/i;

/**
 * Heal-payoff: a benefit triggered or gated on removing damage. Covers the repeating
 * "whenever/when you remove damage" triggers, the "if you removed damage" turn-state
 * condition, and the "for each N damage removed" / "damage removed this way" / "remove 1
 * or more damage" count payoffs.
 */
const HEAL_PAYOFF_PATTERN =
  /whenever you remove damage|when you remove damage|if you removed damage|for each \d+ damage removed|damage removed this way|remove 1 or more damage/i;

/**
 * Move-damage is the OPPOSITE mechanic (relocating damage between characters, not clearing
 * it); Steel "no damage / undamaged" statics are a different axis again. Neither can create a
 * healer or payoff via the patterns above, so this guard only drops a card whose text is a
 * PURE mover — one with no genuine remove clause and no payoff. That keeps a dual card like
 * Isabela Madrigal - Perfectly in Control (moves damage onto herself in one clause, then
 * "remove[s] all damage from this character" in another) as a real healer.
 */
const MOVE_DAMAGE_PATTERN = /\bmove\b[^.]*\bdamage\b/i;

/** Fast pre-filter: every heal pattern contains "remove" or "damage removed". */
const HAS_HEAL_KEYWORD = /remove|damage removed/i;

/**
 * Pure-mover guard: true when a card is a bare damage-mover — no genuine remove clause and
 * no payoff, with a "move ... damage" interaction (see MOVE_DAMAGE_PATTERN). Split out of
 * getHealRoles so the flagged three-branch guard reads as one named check.
 */
function isPureDamageMover(text: string, healer: boolean, payoff: boolean): boolean {
  return !healer && !payoff && MOVE_DAMAGE_PATTERN.test(text);
}

/** Determine the heal role(s) a card fulfills. A card can be both (e.g. Ohana Means Family). */
export function getHealRoles(card: LorcanaCard): HealRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!HAS_HEAL_KEYWORD.test(text)) return [];

  const healer = HEALER_PATTERN.test(text);
  const payoff = HEAL_PAYOFF_PATTERN.test(text);
  if (isPureDamageMover(text, healer, payoff)) return [];

  const roles: HealRole[] = [];
  if (healer) roles.push('healer');
  if (payoff) roles.push('heal-payoff');
  return roles;
}

/** Check if a card participates in the heal axis (healer or heal-payoff). */
export const isHealCard = (card: LorcanaCard): boolean => getHealRoles(card).length > 0;

// ============================================
// TRIBAL PLAYSTYLES (Monster, Princess, Hero, Super, Royalty) — shared detector
// ============================================

/**
 * Generic tribal roles, reused across every classification tribe. All ids already
 * exist in the mechanics catalog (buff/trigger/search/in-play-check from
 * Location/Floodborn/Hunny, member is membership), so no new tile labels are needed.
 */
export type TribalRole = 'member' | 'buff' | 'trigger' | 'search' | 'in-play-check';

/** A tribal playstyle: which classification(s) make a member, and the word(s) its payoffs name. */
export interface TribalSpec {
  playstyleId: string;
  /** Classifications that make a card a member. */
  memberClasses: readonly string[];
  /** Words payoffs use to name the tribe (usually the classes; Royalty spans Queen/King/Prince). */
  refWords: readonly string[];
}

/** The six tribal specs. Royalty deliberately excludes Princess so it complements the Princess rule. */
export const TRIBAL_SPECS = {
  monster: {playstyleId: 'monster', memberClasses: ['Monster'], refWords: ['Monster']},
  princess: {playstyleId: 'princess', memberClasses: ['Princess'], refWords: ['Princess']},
  hero: {playstyleId: 'hero', memberClasses: ['Hero'], refWords: ['Hero']},
  super: {playstyleId: 'super', memberClasses: ['Super'], refWords: ['Super']},
  royalty: {playstyleId: 'royalty', memberClasses: ['Queen', 'King', 'Prince'], refWords: ['Queen', 'King', 'Prince']},
  // Detectives — the Set 10 (Zootopia / Great Mouse Detective) tribe. 39 members, 8
  // pattern-caught payoffs (all Set 10, Sapphire/Steel-heavy). Drop-in over the shared
  // factory: reuses member/buff/trigger/search/in-play-check, no new roles.
  detective: {playstyleId: 'detective', memberClasses: ['Detective'], refWords: ['Detective']},
} as const satisfies Record<string, TribalSpec>;

const tribalPatternCache = new Map<string, {buff: RegExp; trigger: RegExp; search: RegExp; check: RegExp}>();

function tribalPatterns(spec: TribalSpec) {
  const cached = tribalPatternCache.get(spec.playstyleId);
  if (cached) return cached;
  const w = spec.refWords.join('|');
  const T = `(?:${w})`;
  const p = {
    // Benefit the tribe: team buff, single-target buff, or tribal ready (all strengthen/free your bodies).
    buff: new RegExp(
      `your (?:other )?${T}[^.]{0,18}characters? (?:get|gain|can)` + // team: "your [other] X characters get/gain/can't-be..."
        `|chosen ${T} character[^.]{0,12}(?:gets|gains|can|\\+\\d)` + // single-target: "chosen X character gains ..." or a give-form "+N" stat buff (Flash - Records Specialist)
        `|ready (?:your|chosen)[^.]{0,30}${T} characters?`, // tribal ready: "ready your other exerted X characters"
      'i',
    ),
    // Repeating trigger tied to the tribe: on play, quest, or challenge.
    trigger: new RegExp(
      `whenever you play (?:a|an|another|this or another) ${T}\\b` + // "whenever you play another X"
        `|whenever[^.]{0,40}your (?:other )?${T} characters?[^.]{0,20}(?:quest|challenge)`, // "whenever one of your X characters challenges"
      'i',
    ),
    // Deck dig for a tribe member.
    search: new RegExp(`(?:search your deck for|reveal) (?:a|an) ${T} character`, 'i'),
    // Conditional gated on tribe presence or a tribe event this turn.
    check: new RegExp(
      `(?:while|if) you have (?:a|an|another|\\d+ or more)[^.]{0,30}${T}\\b` + // "while you have a [Dwarfs or a] X character in play"
        `|if (?:a|an) (?:\\w+ or (?:a )?)?${T}(?: or \\w+)? character (?:is|card)` + // "if a [Y or] X [or Y] character is in play/chosen"
        `|if you (?:played|returned)[^.]{0,20}${T} character` + // "if you played a X character this turn"
        `|if (?:that card|the \\w+) is (?:a|an) ${T} character card`, // "if that card is a X character card"
      'i',
    ),
  };
  tribalPatternCache.set(spec.playstyleId, p);
  return p;
}

/** Determine a card's roles for one tribal spec. Multi-role allowed; payoffs never require membership. */
export function getTribalRoles(card: LorcanaCard, spec: TribalSpec): TribalRole[] {
  const roles: TribalRole[] = [];
  if (card.type === 'Character' && spec.memberClasses.some((c) => hasClassification(card, c))) roles.push('member');

  if (card.text != null) {
    const text = normalizeCardText(card);
    const p = tribalPatterns(spec);
    if (p.buff.test(text)) roles.push('buff');
    if (p.trigger.test(text)) roles.push('trigger');
    if (p.search.test(text)) roles.push('search');
    if (p.check.test(text)) roles.push('in-play-check');
  }
  return roles;
}

export const isTribalCard = (card: LorcanaCard, spec: TribalSpec): boolean =>
  getTribalRoles(card, spec).length > 0;

// ============================================
// EXERT DETECTION ("Exert Matters" — opponent-facing, payoff-anchored)
// ============================================

/**
 * Exert is the opponent-facing soft-removal axis (a clean revival of the archived
 * `exert-synergies` rule; see REMOVED_RULES.md). Two roles:
 *  - 'exert-enabler' — an EFFECT that exerts an OPPOSING character (a soft tap that
 *    keeps the body from questing/challenging next turn).
 *  - 'exert-payoff'  — consumes or rewards an ALREADY-exerted opposing body WITHOUT
 *    self-exerting: banish it, lock it (can't ready), or scale off its exerted state.
 *
 * Payoff-anchored (like Floodborn / Items): two enablers never synergize with each
 * other, so the rule (see rules.ts) drops enabler↔enabler pairs. Mono-Amethyst in
 * practice (16/21 enablers, 10/12 payoffs).
 */
export type ExertRole = 'exert-enabler' | 'exert-payoff';

/**
 * enabler — an effect that exerts an OPPOSING character. Both the verb pattern and the
 * opposing-character reference must match. The `(?:\w+ ){0,2}` slot in HAS_OPPOSING_CHAR
 * admits an adjective ("exert chosen opposing READY character", Ursula - Voice Stealer).
 */
const EXERT_OPPOSING_VERB =
  /\bexerts?\b\s+(?:up to \d+ )?(?:all |each )?(?:chosen |target )?(?:opposing|opponent'?s)/i;
const EXERT_HAS_OPPOSING_CHAR =
  /opposing (?:\w+ ){0,2}character|opponent'?s (?:\w+ ){0,2}character/i;
/** Exert-an-ITEM effect ("exert chosen opposing item") — a different axis; excluded from both roles. */
const EXERT_ITEM_ONLY = /\bexerts?\b[^.]{0,25}\bitems?\b/i;

/**
 * Self-exert-state gate: a payoff powered by THIS character being exerted (Genie -
 * Main Attraction) is an engine on your own side, not a consumer of an opponent's
 * exerted body. Excluded from the payoff role.
 */
const EXERT_SELF_STATE = /while this character is exerted|if this character is exerted/i;

/**
 * Consume-tier payoffs (score 8 vs an enabler): turn the exerted body into a kill or
 * hard lock — an exert-trigger, a banish-of-an-exerted-body, or a can't-ready lock.
 */
const EXERT_PAYOFF_TRIGGER =
  /when(?:ever)?\s+(?:an?\s+)?(?:opposing|opponent'?s)[^.]{0,40}(?:is|are|gets?|becomes?)\s+exerted/i;
const EXERT_PAYOFF_BANISH = /banish (?:chosen |an? )?exerted (?:opposing )?character/i;
const EXERT_PAYOFF_CANT_READY =
  /chosen (?:opposing )?exerted character[^.]{0,30}can'?t ready|exerted character can'?t ready at the start of (?:their|its) next turn/i;

/**
 * State-tier payoffs (score 6 vs an enabler): scale off an opponent HAVING an exerted
 * body without hard-punishing it ("if an opponent has an exerted character", "for each
 * exerted character opponents have", "gain lore equal to another chosen exerted character").
 */
const EXERT_PAYOFF_OPP_STATE =
  /if an opponent has an exerted character|opponent has an exerted character in play|for each exerted character opponents have/i;
const EXERT_PAYOFF_LORE =
  /gain lore equal to[^.]{0,40}chosen exerted character|another chosen exerted character/i;

/** Fast pre-filter: every exert pattern contains "exert". */
const HAS_EXERT_KEYWORD = /exert/i;

/** True when a payoff hard-punishes the exerted body (banish / lock / trigger) → score 8 vs enabler. */
export function isExertConsumePayoff(card: LorcanaCard): boolean {
  if (card.text == null) return false;
  const t = normalizeCardText(card);
  return (
    EXERT_PAYOFF_TRIGGER.test(t) || EXERT_PAYOFF_BANISH.test(t) || EXERT_PAYOFF_CANT_READY.test(t)
  );
}

/** True when a payoff scales off the opponent's exerted state without punishing it → score 6 vs enabler. */
function isExertStatePayoff(t: string): boolean {
  return EXERT_PAYOFF_OPP_STATE.test(t) || EXERT_PAYOFF_LORE.test(t);
}

/**
 * Enabler: exerts an OPPOSING character (not an item). Exert-as-cost (⟳ glyph) never matches
 * this effect shape, so cost-glyph cards are excluded by construction. Split out of
 * getExertRoles so its role builder stays a flat sequence of named checks.
 */
function isExertEnabler(t: string): boolean {
  return EXERT_OPPOSING_VERB.test(t) && EXERT_HAS_OPPOSING_CHAR.test(t) && !EXERT_ITEM_ONLY.test(t);
}

/** Payoff: consumes/rewards an already-exerted opposing body, and is NOT self-exert powered. */
function isExertPayoff(card: LorcanaCard, t: string): boolean {
  return !EXERT_SELF_STATE.test(t) && (isExertConsumePayoff(card) || isExertStatePayoff(t));
}

/**
 * Determine the exert role(s) a card fulfills. Enabler and payoff are independent gates,
 * so a card could in principle be both (none in the live database are).
 */
export function getExertRoles(card: LorcanaCard): ExertRole[] {
  if (card.text == null) return [];
  const t = normalizeCardText(card);
  if (!HAS_EXERT_KEYWORD.test(t)) return [];

  const roles: ExertRole[] = [];
  if (isExertEnabler(t)) roles.push('exert-enabler');
  if (isExertPayoff(card, t)) roles.push('exert-payoff');
  return roles;
}

export const isExertCard = (card: LorcanaCard): boolean => getExertRoles(card).length > 0;
// ============================================
// MERIDA ARCHER DETECTION (Merida - Formidable Archer, STEADY AIM)
// ============================================

/**
 * Anchor: a card whose ability adds damage whenever one of your ACTIONS deals
 * damage to an opposing character (Merida - Formidable Archer's STEADY AIM).
 * Matched on the ability text, not a card id, so any reprint with the same
 * wording joins the rule for free. `deals?` covers the singular "deals" printed
 * on the card and a possible "deal" reprint. Against the current pool the pattern
 * matches exactly one card (Merida, id 2906).
 */
const STEADY_AIM_ANCHOR_PATTERN =
  /whenever one of your actions deals? damage to an opposing character/i;

/** An Action that itself deals a fixed amount of damage: "deal N damage". */
const ACTION_DAMAGE_PATTERN = /\bdeals?\s+\d+\s+damage\b/i;

/**
 * Self-only removal (Break Free): "deal N damage to chosen character of yours"
 * targets YOUR OWN character, never an opposing one, so STEADY AIM (which keys on
 * damage to an OPPOSING character) can never fire off it. Excluded.
 */
const ACTION_DAMAGE_SELF_ONLY_PATTERN =
  /deals?\s+\d+\s+damage to chosen character of yours/i;

/**
 * Granted-ability action (Food Fight!): the damage lives inside an ability the
 * action GRANTS to a character ("Your characters gain “... Deal 1 damage ...”"),
 * so the damage is dealt by the granted CHARACTER ability, not by the action
 * itself. STEADY AIM fires on an ACTION dealing damage, so these don't combo.
 * The char classes include both curly (“”) and straight (") quotes because the
 * live card data prints curly quotes; keep both so a straight-quote reprint also matches.
 */
const ACTION_DAMAGE_GRANTED_PATTERN =
  /\bgains?\b[^.]{0,40}["“'][^"”']*deals?\s+\d+\s+damage/i;

/**
 * Multi-target damage: hits more than one body (board-wipe "each", "up to N
 * chosen", or a follow-up "another chosen"). Each extra target is another STEADY
 * AIM trigger, so multi-target actions earn a +1 scoring bump.
 */
const ACTION_DAMAGE_MULTI_PATTERN = /each|up to \d+ chosen|another chosen/i;

/** True when a card carries the STEADY AIM anchor ability (matched on text, not id). */
export function isSteadyAimAnchor(card: LorcanaCard): boolean {
  return STEADY_AIM_ANCHOR_PATTERN.test(normalizeCardText(card));
}

/** The fixed damage an Action deals ("deal N damage" → N), or 0 if none. */
export function getActionDamage(card: LorcanaCard): number {
  const match = normalizeCardText(card).match(/deals?\s+(\d+)\s+damage/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Payoff: an Action that deals fixed damage to an (opposing) character, so
 * Merida's STEADY AIM adds 2 damage every time it lands. Excludes self-only
 * removal ("chosen character of yours") and granted-ability damage (Food Fight!),
 * neither of which triggers STEADY AIM.
 */
export function isMeridaDamageAction(card: LorcanaCard): boolean {
  if (!isAction(card) || card.text == null) return false;
  const text = normalizeCardText(card);
  if (!ACTION_DAMAGE_PATTERN.test(text)) return false;
  if (ACTION_DAMAGE_SELF_ONLY_PATTERN.test(text)) return false;
  if (ACTION_DAMAGE_GRANTED_PATTERN.test(text)) return false;
  return true;
}

/** True when an Action hits multiple targets (each / up to N chosen / another chosen). */
export function isMultiTargetDamageAction(card: LorcanaCard): boolean {
  return ACTION_DAMAGE_MULTI_PATTERN.test(normalizeCardText(card));
}

// ============================================
// BOUNCE DETECTION ("return from play to hand")
// ============================================

/**
 * Bounce is the "return from play to hand" axis. Two payoff shapes anchor it:
 *  - self-bounce (enabler) returns a chosen OWN body to your hand, re-firing its
 *    enter-play (ETB) ability — cashed in by a `rebuy-payoff` ETB body.
 *  - opponent-bounce (tempo/removal) returns a body to their player's hand — cashed
 *    in by the single `return-payoff` (Maleficent's Staff: lore on every opponent return).
 *  - flexible cards ("return chosen character/item/location to their player's hand",
 *    no side restriction) hit BOTH sides, so they carry the `flexible` role and act as
 *    a self-bounce enabler AND an opponent-bounce.
 *
 * Disjoint by construction from Self-Discard's "from your discard" reanimator (a bounce
 * returns from PLAY, not the bin) and from Challenge Matters' "banished in a challenge"
 * combat-recursion (no `banish` verb participates in these patterns).
 */
export type BounceRole = 'self-bounce' | 'flexible' | 'opponent-bounce' | 'return-payoff' | 'rebuy-payoff';

/** self-bounce enabler — return a CHOSEN own body to YOUR hand (the `of yours` gate = your side). */
const BOUNCE_SELF_PATTERN =
  /return\s+(?:another\s+)?chosen\s+(?:\w+\s+){0,2}?characters?(?:\s+card)?\s+of\s+yours\b[^.]{0,50}?to\s+your\s+hand/i;
/** flexible — "return [up to N] chosen character/item/location … to their player's hand", no side gate. */
const BOUNCE_FLEX_PATTERN =
  /return\s+(?:up to \d+\s+)?(?:a\s+|an\s+)?chosen\s+(?:character|item|location)[^.]{0,80}?to\s+their\s+player'?s?\s+hand/i;
/** Any "return … to their player's hand" — the opponent-side umbrella (flexible is the un-restricted subset). */
const BOUNCE_TO_THEIR_HAND_PATTERN = /return\s+(?:up to \d+\s+)?[^.]{0,80}?to\s+their\s+player'?s?\s+hand/i;
const BOUNCE_OF_YOURS = /\bof\s+yours\b/i;
const BOUNCE_OPPONENT_SIDE = /opposing|opponent'?s?\b/i;
/** return-payoff — gain value whenever a card is returned to hand from play (Maleficent's Staff). */
const BOUNCE_RETURN_PAYOFF_PATTERN =
  /when(?:ever)?\s+[^.]{0,90}?\bis\s+returned\s+to\s+(?:their|your|its player'?s?)\s+hand/i;
/** rebuy-payoff — a "when you play this character" ETB whose effect is unambiguous re-fire value. */
const BOUNCE_ETB_PATTERN = /when\s+you\s+play\s+this\s+character/i;
const BOUNCE_REBUY_EFFECT_PATTERN =
  /draw\s+(?:\d+|two|three)\s+cards?|search\s+your\s+(?:deck|library)|look at the top \d+ cards of your deck|banish\s+(?:a|an|another\s+)?chosen\s+character|(?:play|put)\b[^.]{0,50}for free|without paying/i;
/**
 * Fast pre-filter. Admits BOTH the "return … to hand" bounce shapes AND the enter-play bodies
 * the re-buy payoff keys on — a rebuy body (e.g. Merlin - Turtle's deck-dig ETB) need not contain
 * "return", so a return-only prefilter would silently drop the whole rebuy-payoff pool.
 */
const HAS_BOUNCE_KEYWORD = /return|is returned|when you play this character/i;

/**
 * Cost cap on the RETURN clause only ("return … chosen … with cost N [or less] … to your/their
 * hand"). The `(?!\s+or\s+more)` guard keeps a song's "cost N or more" sing reminder from reading
 * as a cap; `[^.]` keeps both reads inside the one sentence.
 */
const BOUNCE_COST_CAP_PATTERN =
  /return\s+(?:up to \d+\s+)?(?:another\s+)?chosen\s+[^.]*?\bwith\s+cost\s+(\d+)(?!\s+or\s+more)(?:\s+or\s+less)?\b[^.]*?to\s+(?:your|their\s+player'?s?)\s+hand/i;
/**
 * Classification gate ("return chosen Seven Dwarfs character of yours"). Case-sensitive on purpose:
 * a capitalised run is a classification, a lowercase adjective ("exerted", "another") is not. Only
 * the verb is case-flexible (`[Rr]eturn`), since it can open a sentence or sit inside one.
 */
const BOUNCE_CLASS_GATE_PATTERN =
  /[Rr]eturn\s+(?:another\s+)?chosen\s+([A-Z][\w']*(?:\s+[A-Z][\w']*)*)\s+characters?\s+of\s+yours\b/;

/** What a bounce enabler may legally return: a cost ceiling and/or a required classification (null = unrestricted). */
export interface BounceTargetGate {
  costCap: number | null;
  classification: string | null;
}

/** Read the target gate off a bounce enabler's return clause. */
export function getBounceTargetGate(card: LorcanaCard): BounceTargetGate {
  const text = normalizeCardText(card);
  const capMatch = BOUNCE_COST_CAP_PATTERN.exec(text);
  const classMatch = BOUNCE_CLASS_GATE_PATTERN.exec(text);
  return {
    costCap: capMatch ? Number.parseInt(capMatch[1], 10) : null,
    classification: classMatch ? classMatch[1] : null,
  };
}

/** True when the enabler behind `gate` can legally return `target` (uncapped gates admit everything). */
export function bounceGateAdmits(gate: BounceTargetGate, target: LorcanaCard): boolean {
  const costOk = gate.costCap === null || target.cost <= gate.costCap;
  const classOk = gate.classification === null || hasClassification(target, gate.classification);
  return costOk && classOk;
}

/**
 * A re-buyable ETB body: a "when you play this character" enter-play with unambiguous re-fire
 * value (draw 2+, deck search, free-play, banish-chosen). Shift bodies are excluded — their
 * re-buy already surfaces through the Shift Targets rule, so pairing them here only duplicates it.
 */
function isBounceRebuyPayoff(card: LorcanaCard, text: string): boolean {
  return (
    isCharacter(card) &&
    BOUNCE_ETB_PATTERN.test(text) &&
    BOUNCE_REBUY_EFFECT_PATTERN.test(text) &&
    !hasAnyShift(card)
  );
}

/** flexible — an un-restricted "return chosen … to their player's hand" (neither self-only nor opponent-only). */
function isBounceFlexible(text: string): boolean {
  return (
    BOUNCE_FLEX_PATTERN.test(text) && !BOUNCE_OF_YOURS.test(text) && !BOUNCE_OPPONENT_SIDE.test(text)
  );
}

/** opponent-bounce — returns a body to their hand for tempo, but is neither self-bounce nor flexible. */
function isBounceOpponentOnly(text: string, self: boolean, flexible: boolean): boolean {
  return !self && !flexible && BOUNCE_TO_THEIR_HAND_PATTERN.test(text);
}

/**
 * Determine the bounce role(s) a card fulfills. Multi-role allowed: a self-bounce enabler that is
 * itself a re-buyable ETB body (e.g. Witches of Morva) carries both roles and self-pairs.
 */
export function getBounceRoles(card: LorcanaCard): BounceRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!HAS_BOUNCE_KEYWORD.test(text)) return [];

  const self = BOUNCE_SELF_PATTERN.test(text);
  const flexible = isBounceFlexible(text);
  const roles: BounceRole[] = [];
  if (self) roles.push('self-bounce');
  if (flexible) roles.push('flexible');
  if (isBounceOpponentOnly(text, self, flexible)) roles.push('opponent-bounce');
  if (BOUNCE_RETURN_PAYOFF_PATTERN.test(text)) roles.push('return-payoff');
  if (isBounceRebuyPayoff(card, text)) roles.push('rebuy-payoff');
  return roles;
}

/** Check if a card participates in the bounce axis (any role). */
export const isBounceCard = (card: LorcanaCard): boolean => getBounceRoles(card).length > 0;
