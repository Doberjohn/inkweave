import type {LorcanaCard} from '../../types';
import type {NormalizedText} from '../cardHelpers.js';
import {isSong, normalizeCardText, SENTENCE_BREAK} from '../cardHelpers.js';

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
 *  - 'state-payoff' — rewards the discard EVENT ("discarded a card this turn"), an empty hand, or
 *                     a small one (STONE BY DAY: "3 or more cards in your hand" keeps it exerted).
 *  - 'zone-payoff'  — rewards the discard as a countable ZONE ("10 or more cards in your discard",
 *                     "a song card in your discard", "cards were put into your discard this turn"),
 *                     or spends it as a cost ("you may put 2 character cards from your discard on
 *                     the bottom of your deck to give this character Rush").
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
/**
 * Opponent-facing discard belongs to the Discard rule; exclude it here to keep the two axes
 * disjoint. Search for Clues' "the player or players with the most cards in their hands choose
 * and discard" hits you only while your hand is the biggest, and the Discard rule reads it as
 * comparative targeting, so it is opponent-facing too.
 */
const SELF_DISCARD_OPPONENT_PATTERN =
  /opponent|each player|challenging player|that player|most cards in their hands?/i;

/** Reanimator — play / return / put a card FROM YOUR DISCARD (recursion payoff). */
const SELF_DISCARD_REANIMATOR_PATTERN = /(?:play|return|put)\b[^.]{0,60}\bfrom your discard\b/i;
/**
 * Recursion that can only ever return the card itself or a card it just handled
 * ("return this card from your discard", "a song card you played this turn … from your
 * discard", "If you discarded a location card this way, you may play it from your discard").
 * A hand-discard outlet never feeds it (a mill can only by luck), so its sentence is stripped
 * before the reanimator test. The first branch needs the verb to take "this/that X from your
 * discard" directly, so an enter-play trigger ("When you play this character, return a card
 * from your discard") stays recursion.
 */
const SELF_CONTAINED_RECURSION_PATTERN =
  /\b(?:play|return|put)\s+(?:this|that)\s+(?:card|item|character|location)\s+from your discard\b|\bthose\s+characters\s+from your discard\b|\byou played this turn\b[^.]{0,60}\bfrom your discard\b|\bthis way, you may (?:play|return) it from your discard\b/i;
/** Self-recursion that fires when YOU discard the card is fed by hand discard, so it stays. */
const DISCARD_FED_RECURSION_PATTERN = /\bwhen(?:ever)?\s+you\s+discard\b/i;
/**
 * Recursion of one named card ("return an action card named Three Arrows from your discard",
 * "another character card named Alien"). Only that card switches it on, and Named Companions
 * already pairs the two, so no outlet or mill feeds it. Neither side of "named" may cross
 * another play/return/put, so a named card elsewhere in the sentence ("if you have an item
 * named Rivera Family Photo in play, you may play this item from your discard") stays out.
 */
const NAMED_CARD_RECURSION_PATTERN =
  /\b(?:play|return|put)\b(?:(?!\b(?:play|return|put)\b)[^.]){0,60}?\bnamed\b(?:(?!\b(?:play|return|put)\b)[^.]){0,40}?\bfrom your discard\b/gi;
/**
 * A sweep that moves cards from your discard to the bottom of your deck. No card comes back to
 * hand or play, so it is no recursion, whether the card must make it ("put 3 cards from your
 * discard on the bottom of your deck in any order or banish her", Mamá Imelda - No-Nonsense
 * Ancestor) or may pay it as a cost (see DECK_BOTTOM_COST_PATTERN).
 */
const DECK_BOTTOM_SWEEP_PATTERN =
  /\bput\b[^.]{0,40}?\bfrom your discard on the bottom of your deck\b/gi;
/**
 * A cost paid from the pile: "You may put a Toy character card from your discard on the bottom
 * of your deck to play this character for free" (Hand-in-the-Box - Sid's Toy), "you may put 2
 * character cards from your discard on the bottom of your deck to give this character Rush"
 * (Roller Bob - Sid's Toy). It needs those cards in your discard, so it reads the pile the way a
 * count does, and the kinds it names are the kinds it takes.
 */
const DECK_BOTTOM_COST_PATTERN =
  /\byou may put\b[^.]{0,40}?\bfrom your discard on the bottom of your deck\b/i;

/** The text without its self-contained recursion sentences (see SELF_CONTAINED_RECURSION_PATTERN). */
function stripSelfContainedRecursion(text: NormalizedText): NormalizedText {
  return text
    .split(SENTENCE_BREAK)
    .filter((s) => !(SELF_CONTAINED_RECURSION_PATTERN.test(s) && !DISCARD_FED_RECURSION_PATTERN.test(s)))
    .join(' ') as NormalizedText;
}

/**
 * The text with only the recursion an outlet or a mill can feed: self-contained recursion
 * sentences, named-card recursion clauses and deck-bottom sweeps removed.
 */
function stripUnfedRecursion(text: NormalizedText): NormalizedText {
  return stripSelfContainedRecursion(text)
    .replace(NAMED_CARD_RECURSION_PATTERN, '')
    .replace(DECK_BOTTOM_SWEEP_PATTERN, '') as NormalizedText;
}

/**
 * Recursion that fires on your discard ("when you discard this card, you may play it from your
 * discard"), so a hand discard switches it on.
 */
function hasDiscardFedRecursion(text: NormalizedText): boolean {
  return text
    .split(SENTENCE_BREAK)
    .some((s) => SELF_DISCARD_REANIMATOR_PATTERN.test(s) && DISCARD_FED_RECURSION_PATTERN.test(s));
}

/**
 * Every recursion an outlet can feed fires on your discard (Mother Gothel - Evil as Ever: "when
 * you discard this card, you may play this character from your discard"). A mill puts cards into
 * your discard without discarding them, so it never switches such recursion on.
 */
function recursesOnlyOnDiscard(text: NormalizedText): boolean {
  const recursion = stripUnfedRecursion(text)
    .split(SENTENCE_BREAK)
    .filter((s) => SELF_DISCARD_REANIMATOR_PATTERN.test(s));
  return recursion.length > 0 && recursion.every((s) => DISCARD_FED_RECURSION_PATTERN.test(s));
}
/** State payoff, event half: rewards the discard EVENT ("if you discarded a card this turn"). */
const SELF_DISCARD_EVENT_PATTERN = /discarded\s+a\s+card\s+this\s+turn/i;
/** State payoff, empty-hand shape: "while you have no cards in your hand". */
const SELF_DISCARD_HELLBENT_PATTERN = /no cards in (?:your )?hand/i;
/**
 * State payoff, small-hand shape: the Gargoyles' STONE BY DAY ("If you have 3 or more cards in your
 * hand, this character can't ready"), keyed on the condition rather than the ability name. The
 * Ready step comes before the Draw step, so the hand that counts is the one you end your turn with.
 */
const SELF_DISCARD_SMALL_HAND_PATTERN =
  /if you have 3 or more cards in your hand, this character can't ready/i;
/**
 * Zone payoff — counts or checks cards sitting IN your discard ("10 or more cards in your
 * discard", "for each Alien character card in your discard", "a song card in your discard").
 * "in your discard" keeps it disjoint from the reanimator's "from your discard". A check for one
 * named card ("a character card named Panic in your discard") is no pile check: only that card
 * switches it on, and Named Companions already pairs the two.
 */
const SELF_DISCARD_ZONE_IN_PATTERN =
  /\b(?:a|an|\d+\s+or\s+more|for\s+each)\s+(?:\w+\s+){0,3}?cards?\s+in\s+your\s+discard\b/i;
/** Zone payoff — the "N or more cards were put into your discard this turn" trigger family. */
const SELF_DISCARD_ZONE_PUT_PATTERN = /cards?\s+were\s+put\s+into\s+your\s+discard\s+this\s+turn/i;
/** Mill — fills the bin from the top of the deck. Kept tight: "put the rest / put it into your discard" is not mill. */
const SELF_DISCARD_MILL_PATTERN =
  /put\s+the\s+top\s+(?:card|\d+\s+cards)\s+of\s+your\s+deck\s+into\s+your\s+discard/i;

/** Fast pre-filter: every pattern has "discard", "no cards in" or "cards in your hand". */
const HAS_SELF_DISCARD_KEYWORD = /discard|no cards in|cards in your hand/i;

/**
 * Zone payoff: the "in your discard" count/check shape, the "put into your discard this turn"
 * trigger, or a cost paid from the pile (see paysCostFromPile).
 */
function isSelfDiscardZonePayoff(text: NormalizedText): boolean {
  return (
    SELF_DISCARD_ZONE_IN_PATTERN.test(text) ||
    SELF_DISCARD_ZONE_PUT_PATTERN.test(text) ||
    paysCostFromPile(text)
  );
}

/**
 * A cost paid from the pile (see DECK_BOTTOM_COST_PATTERN) that is no price on recursion the
 * card also makes: Darkwing Duck - Dashing Gadgeteer puts an item card on the bottom of your deck
 * to play another item from your discard, and stays a reanimator.
 */
function paysCostFromPile(text: NormalizedText): boolean {
  return DECK_BOTTOM_COST_PATTERN.test(text) && !isSelfDiscardReanimator(text);
}

/**
 * Reanimator: recursion an outlet or a mill can feed (see stripUnfedRecursion). The raw test
 * runs first, so the sentence split only happens for the few cards that recur anything at all.
 */
function isSelfDiscardReanimator(text: NormalizedText): boolean {
  return (
    SELF_DISCARD_REANIMATOR_PATTERN.test(text) &&
    SELF_DISCARD_REANIMATOR_PATTERN.test(stripUnfedRecursion(text))
  );
}

/** State payoff: the discard event ("discarded a card this turn"), an empty hand or a small one. */
function isSelfDiscardStatePayoff(text: NormalizedText): boolean {
  return (
    SELF_DISCARD_EVENT_PATTERN.test(text) ||
    SELF_DISCARD_HELLBENT_PATTERN.test(text) ||
    SELF_DISCARD_SMALL_HAND_PATTERN.test(text)
  );
}

/** A hand-discard OUTLET: loot, discard-your-hand or discard-as-cost. */
function hasSelfDiscardOutlet(text: NormalizedText): boolean {
  return (
    SELF_DISCARD_LOOT_PATTERN.test(text) ||
    SELF_DISCARD_HAND_PATTERN.test(text) ||
    SELF_DISCARD_COST_PATTERN.test(text)
  );
}

/**
 * Enabler: a hand-discard outlet that is NOT opponent-facing (opponent discard belongs to the
 * Discard rule). Split out of getSelfDiscardRoles so the role builder stays a flat sequence of
 * named pushes.
 */
function isSelfDiscardEnabler(text: NormalizedText): boolean {
  return hasSelfDiscardOutlet(text) && !SELF_DISCARD_OPPONENT_PATTERN.test(text);
}

/** Determine the self-discard role(s) a card fulfills. A card can be multi-role (loot + reanimate). */
export function getSelfDiscardRoles(card: LorcanaCard): SelfDiscardRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!HAS_SELF_DISCARD_KEYWORD.test(text)) return [];

  const roles: SelfDiscardRole[] = [];
  if (isSelfDiscardEnabler(text)) roles.push('enabler');
  if (isSelfDiscardReanimator(text)) roles.push('reanimator');
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

/** A card kind a typed discard, recursion or pile check names. A song is an action (CR 5.4.4.1). */
type SelfDiscardKind = 'character' | 'action' | 'song' | 'item' | 'location';
/**
 * A kind as a clause admits it: a card kind, or characters of one classification when the clause
 * names one ("an Alien character card" admits 'character:Alien').
 */
type SelfDiscardKindEntry = SelfDiscardKind | `character:${string}`;

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
/** A recursion object that takes any card: "a card", "another card", "2 cards". */
const SELF_DISCARD_ANY_OBJECT_PATTERN = /\b(?:a|an|another|any|\d+)\s+cards?\b/i;
/** A recursion object that is the card itself: "this character", "this card", "it". */
const SELF_DISCARD_SELF_OBJECT_PATTERN =
  /\bthis\s+(?:card|character|item|location|action|song)\b|\bit\b/i;
/**
 * An outlet that discards one card and then draws 2+ ("discard a song card. If you do, draw
 * 2 cards"), so it leaves the hand bigger than it found it (Max Goof - Karaoke Star).
 */
const SELF_DISCARD_REFILL_PATTERN =
  /discard\s+an?\s+(?:\w+\s+){0,2}?card\.\s*if you do,\s*draw\s+[2-9]\s+cards/i;
/**
 * An outlet that puts a card in your hand before it discards: a loot ("draw a card, then choose
 * and discard a card", "Draw 2 cards. Then, discard a card at random") or a return ("return that
 * card to your hand, then choose and discard a card"). Your hand ends as big as it was, or bigger.
 */
const SELF_DISCARD_DRAW_FIRST_PATTERN =
  /(?:\bdraws?\b|\b(?:in)?to your hand\b)[^.]*(?:\.\s+(?:then|if you do),?)?[^.]*\bdiscard\b/i;
/**
 * An outlet that puts cards back in your hand after its discard, in the same sentence or the
 * next one when that draws or opens "If you do": "Discard your hand. Draw 2 cards." (You Broke
 * My Smolder), "discard your hand and draw 2 cards" (Syndrome's Remote), "discard your hand. If
 * you do, return a card from your discard to your hand" (Hercules - Young Rescuer). The hand
 * ends small, never empty. Read one ability at a time, so another ability's draw never counts.
 */
const SELF_DISCARD_DRAW_AFTER_PATTERN =
  /\bdiscard\s+(?:your\s+hand|(?:a|an|another|\d+)\s+(?:\w+\s+){0,3}?cards?)\b(?:[^.]*?\b(?:draws?|to your hand)\b|[^.]*\.\s+(?:draw|if you do,[^.]*?\b(?:draws?|to your hand)\b))/i;
/**
 * Goliath - Clan Leader's DUSK TO DAWN: "At the end of each player's turn, if they have more than 2
 * cards in their hand, they choose and discard cards until they have 2" (a shorter hand draws up
 * to 2). It discards from every hand, so the opponent gate keeps it out of the enabler role, but it
 * leaves you 2 cards as your turn ends: the narrow exception that feeds a small-hand payoff alone.
 */
const SELF_DISCARD_HAND_TRIM_PATTERN =
  /\beach player's turn, if they have more than ([0-2]) cards in their hand, they choose and discard cards until they have \1\b/i;

/** An ability that resolves as your turn ends, after your quests, challenges and plays. */
const END_OF_YOUR_TURN_PATTERN = /\bat the end of your turn\b/i;

/** The card's ability blocks, each normalized; the whole text when it carries no sections. */
function selfDiscardAbilityTexts(card: LorcanaCard): NormalizedText[] {
  const sections = card.textSections?.length ? card.textSections : [card.text ?? ''];
  return sections.map((text) => normalizeCardText({...card, text}));
}

/** An ability puts cards back in your hand after its discard (see SELF_DISCARD_DRAW_AFTER_PATTERN). */
function drawsAfterDiscard(blocks: NormalizedText[]): boolean {
  return blocks.some((block) => SELF_DISCARD_DRAW_AFTER_PATTERN.test(block));
}

/**
 * Every outlet on the card sits in an "At the end of your turn" ability (Meeko - Skittish
 * Scrounger: "At the end of your turn, if this character is exerted, choose and discard a card
 * or banish him"), so its discard lands after every check made during the turn.
 */
function discardsOnlyAtEndOfTurn(blocks: NormalizedText[]): boolean {
  const outlets = blocks.filter(hasSelfDiscardOutlet);
  return outlets.length > 0 && outlets.every((block) => END_OF_YOUR_TURN_PATTERN.test(block));
}

/**
 * The card checks this turn's discards as your turn ends ("At the end of your turn, if 2 or more
 * cards were put into your discard this turn, draw a card"), late enough for an end-of-turn
 * outlet to count.
 */
function checksDiscardsAtEndOfTurn(blocks: NormalizedText[]): boolean {
  return blocks.some(
    (block) =>
      END_OF_YOUR_TURN_PATTERN.test(block) &&
      (SELF_DISCARD_EVENT_PATTERN.test(block) || SELF_DISCARD_ZONE_PUT_PATTERN.test(block)),
  );
}

/** A classification narrowing the character kind word right after it: "an Alien character card". */
const SELF_DISCARD_CLASSIFIED_CHARACTER_PATTERN = /\b([A-Z][a-z]+)\s+characters?\b/;

/**
 * The kinds the kind words in `fragment` admit (empty when it names none), with the character
 * kind narrowed to the classification that precedes it.
 */
function selfDiscardKindsIn(fragment: string): Set<SelfDiscardKindEntry> {
  const kinds = new Set<SelfDiscardKindEntry>();
  for (const [word, admits] of SELF_DISCARD_KIND_WORDS) {
    if (word.test(fragment)) admits.forEach((kind) => kinds.add(kind));
  }
  const classification = SELF_DISCARD_CLASSIFIED_CHARACTER_PATTERN.exec(fragment)?.[1];
  if (classification && kinds.delete('character')) kinds.add(`character:${classification}`);
  return kinds;
}

/** What an outlet can put in the bin; null when it can discard any card (or names no known kind). */
function selfDiscardOutletKinds(text: NormalizedText): Set<SelfDiscardKindEntry> | null {
  if (SELF_DISCARD_ANY_OUTLET_PATTERN.test(text)) return null;
  const kinds = selfDiscardKindsIn(SELF_DISCARD_TYPED_OUTLET_PATTERN.exec(text)?.[0] ?? '');
  return kinds.size > 0 ? kinds : null;
}

/**
 * A self-reference ("this card", "it") recurs the card itself: a song, its own type, or for a
 * character each of its classifications, so a classified outlet meets it only when the card
 * carries that classification.
 */
function ownSelfDiscardKinds(card: LorcanaCard): Set<SelfDiscardKindEntry> {
  if (isSong(card)) return new Set(['song']);
  const kind = card.type.toLowerCase() as SelfDiscardKind;
  const classes = kind === 'character' ? (card.classifications ?? []) : [];
  if (classes.length === 0) return new Set([kind]);
  return new Set(classes.map((classification) => `character:${classification}` as const));
}

/**
 * Every "N cards in your discard" check and every cost paid from the pile on a card, read for
 * the kinds it takes.
 */
const SELF_DISCARD_PILE_CHECKS = new RegExp(
  `${SELF_DISCARD_ZONE_IN_PATTERN.source}|${DECK_BOTTOM_COST_PATTERN.source}`,
  'gi',
);

/** The card reads the pile itself: a count or a card type in it, or a cost paid from it. */
function readsSelfDiscardPile(text: NormalizedText): boolean {
  return SELF_DISCARD_ZONE_IN_PATTERN.test(text) || DECK_BOTTOM_COST_PATTERN.test(text);
}

/**
 * What a zone payoff counts in the pile or pays from it; null when any card counts ("10 or more
 * cards in your discard", "cards were put into your discard this turn") or it reads no pile.
 */
function selfDiscardPileKinds(text: NormalizedText): Set<SelfDiscardKindEntry> | null {
  if (SELF_DISCARD_ZONE_PUT_PATTERN.test(text)) return null;
  const kinds = new Set<SelfDiscardKindEntry>();
  for (const [check] of text.matchAll(SELF_DISCARD_PILE_CHECKS)) {
    const counted = selfDiscardKindsIn(check);
    if (counted.size === 0) return null;
    counted.forEach((kind) => kinds.add(kind));
  }
  return kinds.size > 0 ? kinds : null;
}

/**
 * What a reanimator pulls from the bin; null when it takes any card. "This character", "this
 * card" or "it" is a self-reference, and so is an object with no kind word and no generic card.
 * Named-card recursion never gets here: stripUnfedRecursion has removed it.
 */
function selfDiscardRecursionKinds(
  card: LorcanaCard,
  text: NormalizedText,
): Set<SelfDiscardKindEntry> | null {
  const object = SELF_DISCARD_RECURSION_OBJECT_PATTERN.exec(text)?.[1] ?? 'a card';
  if (SELF_DISCARD_SELF_OBJECT_PATTERN.test(object)) return ownSelfDiscardKinds(card);
  const kinds = selfDiscardKindsIn(object);
  if (kinds.size > 0) return kinds;
  return SELF_DISCARD_ANY_OBJECT_PATTERN.test(object) ? null : ownSelfDiscardKinds(card);
}

/** Two entries admit one card: the same kind, and the same classification where both name one. */
function selfDiscardEntriesMeet(a: SelfDiscardKindEntry, b: SelfDiscardKindEntry): boolean {
  const [kindA, classA] = a.split(':');
  const [kindB, classB] = b.split(':');
  const classesMeet = !classA || !classB || classA === classB;
  return kindA === kindB && classesMeet;
}

/** Two kind sets can meet in one card: either side takes any card, or two entries meet. */
function selfDiscardKindsMeet(
  a: Set<SelfDiscardKindEntry> | null,
  b: Set<SelfDiscardKindEntry> | null,
): boolean {
  if (a === null || b === null) return true;
  return [...a].some((entry) => [...b].some((other) => selfDiscardEntriesMeet(entry, other)));
}

/** What a card's discard or recursion can reach. Fixed per card, while the feed check runs per pair. */
interface SelfDiscardFeedProfile {
  /** Kinds the card discards as an outlet; null when it can discard any card. */
  outletKinds: Set<SelfDiscardKindEntry> | null;
  /** The outlet leaves a smaller hand: no draw before its discard (a loot), no refill after. */
  shrinksHand: boolean;
  /** The outlet shrinks the hand and puts no card back in it (see drawsAfterDiscard). */
  drainsHand: boolean;
  /** The card trims your hand to 2 at the end of your turn (Goliath - Clan Leader). */
  trimsHand: boolean;
  /** Every outlet on the card discards at the end of your turn (see discardsOnlyAtEndOfTurn). */
  discardsAtEndOfTurn: boolean;
  /** Kinds the card's recursion pulls, unfed recursion stripped; null when it takes any card. */
  recursionKinds: Set<SelfDiscardKindEntry> | null;
  /** The recursion fires on your discard (see hasDiscardFedRecursion). */
  recursionOnDiscard: boolean;
  /** All of the recursion fires on your discard, so a mill never feeds it (see recursesOnlyOnDiscard). */
  recursionOnlyOnDiscard: boolean;
  /** The state payoff rewards the discard event ("discarded a card this turn"). */
  rewardsEvent: boolean;
  /** The state payoff rewards an empty hand ("while you have no cards in your hand"). */
  rewardsEmptyHand: boolean;
  /** The state payoff needs a small hand to ready (STONE BY DAY). */
  needsSmallHand: boolean;
  /** The zone payoff reads the pile itself (a count, a card type or a cost), whenever it looks. */
  readsPile: boolean;
  /** Kinds the zone payoff counts in the pile; null when any card counts. */
  pileKinds: Set<SelfDiscardKindEntry> | null;
  /** The card checks this turn's discards at the end of your turn (see checksDiscardsAtEndOfTurn). */
  checksAtEndOfTurn: boolean;
}

const selfDiscardFeedProfiles = new WeakMap<LorcanaCard, SelfDiscardFeedProfile>();

/** The card's feed profile, computed once per card object. */
function selfDiscardFeedProfile(card: LorcanaCard): SelfDiscardFeedProfile {
  const cached = selfDiscardFeedProfiles.get(card);
  if (cached) return cached;
  const text = normalizeCardText(card);
  const blocks = selfDiscardAbilityTexts(card);
  const shrinksHand =
    !SELF_DISCARD_REFILL_PATTERN.test(text) && !SELF_DISCARD_DRAW_FIRST_PATTERN.test(text);
  const profile: SelfDiscardFeedProfile = {
    outletKinds: selfDiscardOutletKinds(text),
    shrinksHand,
    drainsHand: shrinksHand && !drawsAfterDiscard(blocks),
    trimsHand: SELF_DISCARD_HAND_TRIM_PATTERN.test(text),
    discardsAtEndOfTurn: discardsOnlyAtEndOfTurn(blocks),
    recursionKinds: selfDiscardRecursionKinds(card, stripUnfedRecursion(text)),
    recursionOnDiscard: hasDiscardFedRecursion(text),
    recursionOnlyOnDiscard: recursesOnlyOnDiscard(text),
    rewardsEvent: SELF_DISCARD_EVENT_PATTERN.test(text),
    rewardsEmptyHand: SELF_DISCARD_HELLBENT_PATTERN.test(text),
    needsSmallHand: SELF_DISCARD_SMALL_HAND_PATTERN.test(text),
    readsPile: readsSelfDiscardPile(text),
    pileKinds: selfDiscardPileKinds(text),
    checksAtEndOfTurn: checksDiscardsAtEndOfTurn(blocks),
  };
  selfDiscardFeedProfiles.set(card, profile);
  return profile;
}

/**
 * How an outlet's discard reaches a payoff: 'trigger' when the discard itself switches the payoff
 * on, 'stock' when it only stocks the bin a recursion payoff replays from (banished characters
 * and played actions stock it too), 'unlock' when it keeps your hand small enough to switch a
 * drawback off (STONE BY DAY).
 */
export type SelfDiscardFeed = 'trigger' | 'stock' | 'unlock';

/**
 * The outlet's discard lands before the payoff checks this turn's discards: it discards during
 * the turn, or the payoff checks as the turn ends. An end-of-turn outlet is too late for a check
 * made while you quest, challenge or play ("If you discarded a card this turn, this character …
 * can challenge ready characters this turn").
 */
function discardLandsInTime(
  outlet: SelfDiscardFeedProfile,
  target: SelfDiscardFeedProfile,
): boolean {
  return !outlet.discardsAtEndOfTurn || target.checksAtEndOfTurn;
}

/**
 * How an outlet's discard reaches a state payoff: any discard in time is a "discarded a card
 * this turn" event, while a small hand needs an outlet that shrinks it (a loot or a refill
 * leaves the hand as big or bigger), and an empty hand one that also puts no card back.
 */
function selfDiscardStateFeed(
  outlet: SelfDiscardFeedProfile,
  target: SelfDiscardFeedProfile,
): SelfDiscardFeed | null {
  const feedsEvent = target.rewardsEvent && discardLandsInTime(outlet, target);
  const feedsEmptyHand = target.rewardsEmptyHand && outlet.drainsHand;
  if (feedsEvent || feedsEmptyHand) return 'trigger';
  return target.needsSmallHand && outlet.shrinksHand ? 'unlock' : null;
}

/** How an outlet's discard reaches recursion: a trigger if it fires on the discard, else stock. */
function selfDiscardRecursionFeed(
  outlet: SelfDiscardFeedProfile,
  target: SelfDiscardFeedProfile,
): SelfDiscardFeed | null {
  if (!selfDiscardKindsMeet(outlet.outletKinds, target.recursionKinds)) return null;
  return target.recursionOnDiscard ? 'trigger' : 'stock';
}

/**
 * How `enabler`'s hand discard reaches `payoff`'s reanimator or state payoff (null if it can't):
 *  - recursion: the outlet's discard kinds must meet the recursion kinds, so a typed outlet
 *    ("discard a song card") feeds song, action and any-card recursion, never character or item
 *    recursion. It is a trigger only when the recursion fires on the discard ("when you discard
 *    this card, you may play it from your discard"); otherwise the outlet just stocks the bin;
 *  - state: a trigger for the discard event, or for an empty hand when the outlet takes cards
 *    from your hand and puts none back (no loot, no refill, no draw after the discard); an
 *    unlock for a small hand, which only an outlet that shrinks the hand feeds.
 * A trigger wins over a stock or an unlock. Reads the payoff's text with unfed recursion
 * stripped, like getSelfDiscardRoles.
 */
export function selfDiscardOutletFeed(
  enabler: LorcanaCard,
  payoff: LorcanaCard,
  payoffRoles: SelfDiscardRole[],
): SelfDiscardFeed | null {
  const outlet = selfDiscardFeedProfile(enabler);
  const target = selfDiscardFeedProfile(payoff);
  const state = payoffRoles.includes('state-payoff') ? selfDiscardStateFeed(outlet, target) : null;
  if (state === 'trigger') return state;
  const recursion = payoffRoles.includes('reanimator')
    ? selfDiscardRecursionFeed(outlet, target)
    : null;
  return recursion ?? state;
}

/**
 * Whether `enabler`'s hand discard reaches `payoff`'s zone payoff (the enabler ↔ zone-payoff
 * row): the outlet's kinds must meet the kinds the payoff counts ("discard a song card" never
 * adds to "for each item card in your discard"), and then a count or a card type in the pile
 * always takes it, a "cards were put into your discard this turn" check only when the discard
 * lands in time (see discardLandsInTime).
 */
export function selfDiscardOutletFeedsPile(enabler: LorcanaCard, payoff: LorcanaCard): boolean {
  const outlet = selfDiscardFeedProfile(enabler);
  const target = selfDiscardFeedProfile(payoff);
  if (!selfDiscardKindsMeet(outlet.outletKinds, target.pileKinds)) return false;
  return target.readsPile || discardLandsInTime(outlet, target);
}

/**
 * Whether a mill stocks `payoff`'s recursion (the mill ↔ reanimator row): not when all of it fires
 * on your discard, since a milled card is put into your discard, not discarded.
 */
export function selfDiscardMillFeedsRecursion(payoff: LorcanaCard): boolean {
  return !selfDiscardFeedProfile(payoff).recursionOnlyOnDiscard;
}

/**
 * How a hand trim (Goliath - Clan Leader) reaches a payoff: it unlocks a small-hand payoff and
 * nothing else. It resolves once your turn's actions are done, and it draws a short hand back up
 * to 2, so it never switches on a "discarded a card this turn" or an empty-hand payoff.
 */
export function selfDiscardHandTrimFeed(
  trimmer: LorcanaCard,
  payoff: LorcanaCard,
): SelfDiscardFeed | null {
  const unlocks =
    selfDiscardFeedProfile(trimmer).trimsHand && selfDiscardFeedProfile(payoff).needsSmallHand;
  return unlocks ? 'unlock' : null;
}
