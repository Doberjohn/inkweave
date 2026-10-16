import type {LorcanaCard} from '../../types';
import {
  hasClassification,
  hasKeyword,
  isCharacter,
  isLocation,
  makeSearchPattern,
  normalizeCardText,
} from '../cardHelpers.js';

// ============================================
// LOCATION SUPPORT DETECTION
// ============================================

/** Text patterns for each location-support role */
export const LOCATION_PATTERNS = {
  // "Your characters at locations get +1 ¤" (Russell - Senior Wilderness Explorer) rewards
  // characters for being at a location; it strengthens no location, so it is no buff.
  'at-payoff':
    /while\b.{0,60}at a location|if\b.{0,60}at a location|is at a location|\bcharacters at locations\b/i,
  // The mover may be named by pronoun ("move him to one of your locations", Colonel Hathi) and may
  // move a second character first ("move this character and up to 1 of your other characters to
  // that location", Carl Fredricksen), hence the pronouns and the wider second gap.
  move: /\bmove\b[^.]{0,40}?\b(?:characters?|him|her|them)\b[^.]{0,50}?\blocation|to the same location/i,
  // A damage-moving clause ("move 1 damage counter from ..."). The move role strips these clauses
  // (stripDamageMoves) rather than dropping the card, so "damage" in reminder text (The Game's
  // Afoot!) or a separate damage move never hides a real location move.
  'move-exclude': /\bmove\b[^.]{0,20}?\bdamage\b/i,
  // Fires when you PLAY a location (e.g. Elsa - Ice Artisan). Only "you play a location" is the
  // trigger: in "whenever this character becomes exerted, you may play a location" (Fergus -
  // Outpost Builder) the location play is the effect.
  'play-trigger': /when(?:ever)? you play a location/i,
  // Fires when a character MOVES onto a location (e.g. Taffyta, Goofy) — a payoff
  // for the `move` enabler. Split from play-trigger so the two events score apart.
  'move-trigger': /when(?:ever)?[^.]{0,40}moves? to a location/i,
  // A check on one named location ("if you have a location named Sleepy Hollow in play", Get to
  // Safety!) or on a card under one ("a character or location in play with a card under them",
  // Flintheart Glomgold) is no reward for any location in play. One sentence at most.
  'in-play-check':
    /if you have a location(?! named\b)|while you have an? [^.]*?\blocation\b(?! named\b)(?![^.]*\bwith a card under\b)|for each location/i,
  // "a location card named Andy's Room" (Woody - Leader of the Toys) finds that one location only.
  search: makeSearchPattern('location(?!(?:\\s+cards?)?\\s+named\\b)(?:\\s+cards?)?'),
  // "move ... to (one of) your locations" is a move destination (Colonel Hathi), not a buff; "give
  // ... to your locations" still is, even later in the move's sentence. The skip needs that "to" to
  // be the move's first ("up to N" aside), so it reaches only the move's own destination.
  // "Your characters at locations get" strengthens characters, so "locations get" needs
  // locations as its subject.
  buff: /(?<!\bmove\b(?:(?!\bto\b)[^.]|\bup to\b){0,60}\bto (?:one of )?)your locations|(?<!\bat )locations (?:gain|get)\b|location.*can't be challenged|location gains? resist/i,
  boost:
    /under.*(?:characters|character) or locations|under.*locations|locations with boost|play a character or location with boost/i,
  // Each shape stays in one sentence, and a free location play stays in one clause: in "whenever
  // you play a location, you may move this character ... for free" (Carl Fredricksen - On the
  // Move) the free part is the move.
  'location-ramp':
    /\bless\b[^.]*?\b(?:play|move)\b[^.]*?\blocation|\bless\b for[^.]*?\blocation|play a location[^,.]*?(?:from|for free)/i,
  /** Anti-location cards: banish/remove/shuffle locations. Excluded from location-control. */
  'anti-location': /banish (?:chosen |all )(?:item or )?location|shuffle.*location into/i,
  /** Locations that actually benefit from having cards beneath them — used to scope the boost rule. */
  'boost-beneficiary':
    /for each card (?:under|beneath)|cards? (?:from )?(?:under|beneath) (?:this|the) (?:location|card)/i,
} as const;

/**
 * A damage-moving clause (see LOCATION_PATTERNS['move-exclude']) up to the end of its clause: the
 * next period, comma or semicolon, or the next "move", so a later move in its sentence survives.
 * Global flag: use only with replace, never .test().
 */
const DAMAGE_MOVE_CLAUSE = new RegExp(
  `${LOCATION_PATTERNS['move-exclude'].source}(?:(?!\\bmove\\b)[^.,;])*`,
  'gi',
);

/** Card text without its damage-moving clauses, so they neither read as a move nor hide one. */
export function stripDamageMoves(text: string): string {
  return text.replace(DAMAGE_MOVE_CLAUSE, '');
}

/** Whether `text` reads as a location move once its damage-moving clauses are stripped. */
const readsAsLocationMove = (text: string): boolean => LOCATION_PATTERNS.move.test(stripDamageMoves(text));

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
 * Ordered role detectors (order = role-array order). A data table instead of an
 * if-ladder keeps `getLocationRoles` flat — adding a role is one row, not one
 * more branch. `prepare` (move only) strips damage-moving clauses before the test.
 */
const LOCATION_ROLE_DETECTORS: ReadonlyArray<{
  role: LocationRole;
  pattern: RegExp;
  prepare?: (text: string) => string;
}> = [
  {role: 'at-payoff', pattern: LOCATION_PATTERNS['at-payoff']},
  {role: 'move', pattern: LOCATION_PATTERNS.move, prepare: stripDamageMoves},
  {role: 'play-trigger', pattern: LOCATION_PATTERNS['play-trigger']},
  {role: 'move-trigger', pattern: LOCATION_PATTERNS['move-trigger']},
  {role: 'in-play-check', pattern: LOCATION_PATTERNS['in-play-check']},
  {role: 'search', pattern: LOCATION_PATTERNS.search},
  {role: 'buff', pattern: LOCATION_PATTERNS.buff},
  {role: 'boost', pattern: LOCATION_PATTERNS.boost},
  {role: 'location-ramp', pattern: LOCATION_PATTERNS['location-ramp']},
];

/**
 * Get all location roles a card fulfills.
 * Returns empty array for cards with no location interaction.
 */
export function getLocationRoles(card: LorcanaCard): LocationRole[] {
  if (isLocation(card) || !card.text) return [];

  const text = normalizeCardText(card);

  // Anti-location cards (banish/remove locations) are excluded entirely
  if (LOCATION_PATTERNS['anti-location'].test(text)) return [];

  return LOCATION_ROLE_DETECTORS.filter((d) => d.pattern.test(d.prepare ? d.prepare(text) : text)).map(
    (d) => d.role,
  );
}

/**
 * Check if a card is a location-support card (matches any location pattern).
 */
export function isLocationSupportCard(card: LorcanaCard): boolean {
  return getLocationRoles(card).length > 0;
}

/**
 * A location buff limited to one location classification:
 * "Your Hyperia City locations get +2 ⛉." (Hyperia City Express).
 * Case-sensitive on purpose: the classification must be Title Case after "your", so lowercase
 * shapes like "Your characters and locations gain Resist +1" (We'll Save Our Village) and
 * "Your characters at locations get +1 ¤" (Russell) never match.
 * Global flag: use only with matchAll/replace, never .test().
 */
const CLASSIFIED_LOCATION_BUFF = /\b[Yy]our ((?:[A-Z][a-z'-]+ )+)locations\b/g;

/**
 * A move limited to one location classification: "move him to a Hyperia City location"
 * (Chief Bogo - Police Commissioner). Title Case and case-sensitive like the buff shape, so
 * "to a location" / "to one of your locations" stay global. Global flag: matchAll/replace only.
 */
const CLASSIFIED_LOCATION_MOVE = /\bto (?:a|an|one of your) ((?:[A-Z][a-z'-]+ )+)locations?\b/g;

/**
 * The classifications a role clause is limited to, or [] when it is global. Bound to the clause,
 * not the whole card: returns [] when the text still reads as the role after the classified
 * clauses are removed, meaning the card also covers every location. Each classified clause is
 * cut as a sentence break, so a stranded "move him" cannot reach a later "that location" in the
 * same sentence and read as a second, global move.
 */
function classifiedLocationScope(
  card: LorcanaCard,
  scopedClause: RegExp,
  readsAsRole: (text: string) => boolean,
): string[] {
  const text = normalizeCardText(card);
  const scoped = [...text.matchAll(scopedClause)].map((m) => m[1].trim());
  if (scoped.length === 0) return [];
  return readsAsRole(text.replace(scopedClause, '.')) ? [] : scoped;
}

/** Location classifications a card's buff is limited to (['Hyperia City'] for Hyperia City Express). */
export function getLocationBuffClassifications(card: LorcanaCard): string[] {
  return classifiedLocationScope(card, CLASSIFIED_LOCATION_BUFF, (text) => LOCATION_PATTERNS.buff.test(text));
}

/** Location classifications a card's move is limited to (['Hyperia City'] for Chief Bogo). */
export function getLocationMoveClassifications(card: LorcanaCard): string[] {
  return classifiedLocationScope(card, CLASSIFIED_LOCATION_MOVE, readsAsLocationMove);
}

/**
 * A location play capped by cost: "Play a location with cost 3 or less from your discard for
 * free" (Get to Safety!). Global flag: use only with matchAll/replace, never .test().
 */
const CAPPED_LOCATION_PLAY = /\bplay a location\b[^.]*?\bwith cost (\d+) or less\b/gi;

/**
 * The highest location cost a card's location ramp reaches: the cap of its capped location plays,
 * or Infinity when it has none, or when the text still reads as location ramp once they are cut
 * (the card also ramps every location).
 */
function getLocationRampCostCap(card: LorcanaCard): number {
  const text = normalizeCardText(card);
  const caps = [...text.matchAll(CAPPED_LOCATION_PLAY)].map((m) => Number(m[1]));
  if (
    caps.length === 0 ||
    LOCATION_PATTERNS['location-ramp'].test(text.replace(CAPPED_LOCATION_PLAY, '.'))
  ) {
    return Infinity;
  }
  return Math.max(...caps);
}

/**
 * A discount on a move to a location: "pay 1 ⬡ less to move this character to a location"
 * (Raksha - Fearless Mother). Global flag: use only with replace, never .test().
 */
const MOVE_COST_DISCOUNT = /\bless\b[^.]*?\bto move\b[^.]*?\blocation/gi;

/**
 * Whether a card's location ramp only makes moves cheaper. It puts no location into play, so it
 * helps what a move helps, and nothing at a location that costs no ink to move to.
 */
export function isMoveOnlyLocationRamp(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  const rest = text.replace(MOVE_COST_DISCOUNT, '.');
  return rest !== text && !LOCATION_PATTERNS['location-ramp'].test(rest);
}

/**
 * A sentence that puts cards only under characters or locations with Boost ("under one of your
 * characters or locations with Boost", Recovered Page). Global flag: use only with replace.
 */
const WITH_BOOST_SENTENCE = /[^.]*\blocations? with Boost\b[^.]*/gi;

/** Cards under a location, either way round: "under one of your locations", "locations with a card under them". */
const CARDS_UNDER_LOCATION = /\bunder\b[^.]*\blocations?\b|\blocations?\b[^.]*\bunder\b/i;

/**
 * Whether a boost card works only with locations that have Boost: each of its sentences about
 * cards under a location says "with Boost". Blessed Bagpipes also rewards "locations with a card
 * under them", so it works with any location that holds cards.
 */
function boostNeedsBoostKeyword(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  const rest = text.replace(WITH_BOOST_SENTENCE, '.');
  return rest !== text && !CARDS_UNDER_LOCATION.test(rest);
}

/**
 * A sentence whose reward is sized by the location's lore: "draw cards equal to that location's
 * ◊" (Carl Fredricksen - On the Move). Global flag: use only with replace.
 */
const LORE_SIZED_SENTENCE = /[^.]*\bequal to that location's ◊[^.]*/gi;

/**
 * Whether a card's at-location reward is sized by the location's lore in every sentence that
 * reads as one, so it gives nothing at a location without lore.
 */
function atPayoffNeedsLore(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  const rest = text.replace(LORE_SIZED_SENTENCE, '.');
  return rest !== text && !LOCATION_PATTERNS['at-payoff'].test(rest);
}

/** Whether `location` has one of `classifications`; [] means every location. */
const hasAnyClassification = (classifications: string[], location: LorcanaCard): boolean =>
  classifications.length === 0 || classifications.some((c) => hasClassification(location, c));

/** A location ramp reaches locations under its cost cap; a move discount, only locations that cost ink to move to. */
function locationRampReaches(card: LorcanaCard, location: LorcanaCard): boolean {
  if ((location.cost ?? 0) > getLocationRampCostCap(card)) return false;
  return !isMoveOnlyLocationRamp(card) || (location.moveCost ?? 0) > 0;
}

/** The locations a role reaches, for the roles that do not reach every location. */
const LOCATION_ROLE_REACH: Partial<
  Record<LocationRole, (card: LorcanaCard, location: LorcanaCard) => boolean>
> = {
  buff: (card, location) => hasAnyClassification(getLocationBuffClassifications(card), location),
  move: (card, location) => hasAnyClassification(getLocationMoveClassifications(card), location),
  'location-ramp': locationRampReaches,
  'at-payoff': (card, location) => !atPayoffNeedsLore(card) || (location.lore ?? 0) > 0,
  boost: (card, location) => !boostNeedsBoostKeyword(card) || hasKeyword(location, 'Boost'),
};

/**
 * Whether a card's `role` reaches `location`. A classified buff or move reaches only locations of
 * its own classification; a capped location play, only locations under its cap; a move discount,
 * only locations that cost ink to move to; a reward sized by lore, only locations with lore; and
 * cards put under locations "with Boost", only locations with Boost. Every other role reaches
 * every location.
 */
export function locationRoleReaches(card: LorcanaCard, location: LorcanaCard, role: LocationRole): boolean {
  return LOCATION_ROLE_REACH[role]?.(card, location) ?? true;
}

/** Other characters rewarded at the location too: "all characters at that location get +1 ◊". */
const OTHERS_AT_LOCATION = /\bcharacters at (?:that|this|the|a) location\b/i;

/**
 * Clauses that concern only the card itself, by the role they carry, each with the test of
 * whether the rest of the text still reads as that role. Global flags: use only with replace.
 * - move: it moves only itself ("move him to a location", Arthur - Merlin's Assistant); "move
 *   him and one of your other characters" moves another character too.
 * - at-payoff: it is rewarded for being at a location itself ("while this character is at a
 *   location", Shenzi; "if he's at a location", Beast), unless the reward goes to every
 *   character there ("all characters at that location get +1 ◊", Carl Fredricksen & Russell).
 * - move-trigger: it triggers on its own move ("whenever this character moves to a location").
 */
const SELF_ONLY_LOCATION_CLAUSES: ReadonlyArray<{
  role: LocationRole;
  clause: RegExp;
  readsAsRole: (text: string) => boolean;
}> = [
  {
    role: 'move',
    clause: /\bmove (?:this character|him|her)\b(?! and\b)[^.]*?\blocations?\b/gi,
    readsAsRole: readsAsLocationMove,
  },
  {
    role: 'at-payoff',
    clause: /\b(?:this character|he|she)\b(?:'s| is)?[^.,]*?\bat a location\b/gi,
    readsAsRole: (text) =>
      LOCATION_PATTERNS['at-payoff'].test(text) || OTHERS_AT_LOCATION.test(text),
  },
  {
    role: 'move-trigger',
    clause: /\b(?:this character|he|she) moves? to a location\b/gi,
    readsAsRole: (text) => LOCATION_PATTERNS['move-trigger'].test(text),
  },
];

/**
 * A character's location roles whose every clause concerns only itself. Two such clauses do
 * nothing for each other: a character that moves only itself never puts another character at a
 * location, and one rewarded only for its own position needs its own move.
 */
export function getSelfOnlyLocationRoles(card: LorcanaCard): LocationRole[] {
  if (!isCharacter(card)) return [];
  const text = normalizeCardText(card);
  return SELF_ONLY_LOCATION_CLAUSES.filter(({clause, readsAsRole}) => {
    const rest = text.replace(clause, '.');
    return rest !== text && !readsAsRole(rest);
  }).map(({role}) => role);
}

/**
 * A Location qualifies as a boost target only if its text references cards beneath it.
 * Without this gate, every Location pairs with every boost-role support card.
 */
export function isBoostBeneficiaryLocation(card: LorcanaCard): boolean {
  if (!isLocation(card)) return false;
  if (!card.text) return false;
  return LOCATION_PATTERNS['boost-beneficiary'].test(normalizeCardText(card));
}
