import type {LorcanaCard} from '../../types';
import {normalizeCardText, SENTENCE_BREAK} from '../cardHelpers.js';

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
 * "Look at the top 2 cards of your deck. Put one into your hand and the other into your
 * inkwell." The ink comes from the look in its sentence or the next: Closet Door Portal's look
 * plays a card for free, and its closing "Put this card into your inkwell" is self-sacrifice.
 */
const DECK_LOOK_TO_INKWELL = /look\s+at\s+the\s+top[^.]*(?:\.\s*[^.]*)?into\s+your\s+inkwell/i;

/**
 * Inkwell ramp patterns — cards that put cards into YOUR inkwell.
 * Covers: deck-top ramp, hand-to-inkwell, board-to-inkwell, discard-to-inkwell.
 */
const INKWELL_RAMP_PATTERNS: RegExp[] = [
  // "put the top card of your deck into your inkwell"
  /put\s+the\s+top\s+card\s+of\s+your\s+deck\s+into\s+your\s+inkwell/i,
  // "look at the top X cards...put...into your inkwell"
  DECK_LOOK_TO_INKWELL,
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
  // "put a card from your discard into your inkwell" (Jiminy Cricket - Ghost of Christmas Past)
  /put\s+a\s+card\s+from\s+your\s+discard\s+into\s+your\s+inkwell/i,
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
export const COST_REDUCTION_SELF_PATTERN = /you\s+pay\s+\d+\s+⬡?\s*less\s+⬡?\s*to\s+play\s+this/i;

/**
 * A discount for the cards of one name: "You pay 1 ⬡ less to play characters named Gurgi."
 * (Munchings and Crunchings), "you pay 2 ⬡ less for the next character named Ellie Fredricksen"
 * (Carl Fredricksen - Loving Husband). It helps that one partner, which Named Companions pairs,
 * so getRampRoles reads no cost reduction from it.
 */
const NAMED_DISCOUNT_PATTERN =
  /you\s+pay\s+\d+\s+⬡?\s*less\s+(?:for\s+the\s+(?:next|first)\s+|to\s+play\s+)[^.]{0,30}?\bnamed\b/gi;

/**
 * Self-discount via free-play: "play this character for free" — the limit case
 * of self cost reduction (cost = 0). Distinct shape from "you pay N less", but
 * the same mechanic: this character's mana cost is reduced when a condition is met.
 * Strict "this character" qualifier prevents matching grants like
 * "play your next Toy for free".
 */
export const SELF_DISCOUNT_FREE_PATTERN = /play\s+this\s+character\s+for\s+free/i;

/** Fast pre-filter: skip cards without any ramp-related keywords */
const HAS_RAMP_KEYWORD = /inkwell|you pay \d+.*less/i;

/** Puts cards into YOUR inkwell: an opponent-inkwell effect counts only when it also ramps you. */
function rampsYourInkwell(t: string): boolean {
  if (!INKWELL_RAMP_PATTERNS.some((p) => p.test(t))) return false;
  return !OPPONENT_INK_PATTERN.test(t) || /into\s+your\s+inkwell/i.test(t);
}

/** Reduces the cost of OTHER cards: not a self-discount, nor a discount for one name only. */
function grantsCostReduction(t: string): boolean {
  const grants = t.replace(NAMED_DISCOUNT_PATTERN, '');
  return COST_REDUCTION_GRANT_PATTERN.test(grants) && !COST_REDUCTION_SELF_PATTERN.test(grants);
}

/** Each ramp role with the check that grants it, in the order getRampRoles reports them. */
const RAMP_ROLE_CHECKS: ReadonlyArray<readonly [RampRole, (t: string) => boolean]> = [
  ['inkwell-ramp', rampsYourInkwell],
  ['inkwell-trigger', (t) => INKWELL_TRIGGER_PATTERNS.some((p) => p.test(t))],
  ['cost-reduction', grantsCostReduction],
];

/**
 * Determine the ramp role(s) a card fulfills.
 * A card can have multiple roles (e.g., a card that both ramps and triggers).
 */
export function getRampRoles(card: LorcanaCard): RampRole[] {
  if (!card.text) return [];
  const t = normalizeCardText(card);
  if (!HAS_RAMP_KEYWORD.test(t)) return [];
  return RAMP_ROLE_CHECKS.filter(([, applies]) => applies(t)).map(([role]) => role);
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
    DECK_LOOK_TO_INKWELL.test(t) ||
    /put\s+up\s+to\s+\d+\s+cards?\s+from\s+your\s+discard\s+into\s+your\s+inkwell/i.test(t)
  );
}

/**
 * A trigger that gives one chosen character a keyword until the start of your next turn pays off
 * once a turn: a second ink that turn gives the keyword to a character that already has it,
 * unless you have a second target. Fairy Godmother's Wand: "chosen Princess character of yours
 * gains Ward until the start of your next turn." Only keywords without a number qualify, since a
 * second Resist +1 or Challenger +1 stacks.
 */
const LASTING_KEYWORD_GRANT =
  /\bchosen\b[^.]*\bgains?\s+(?:Ward|Evasive|Rush|Alert|Bodyguard|Reckless|Support|Vanish)\b[^.]*\buntil the start of your next turn\b/i;

/**
 * Sub-pattern detection: returns whether a trigger pays off on every ink event (true), or is
 * capped at once per turn (false): "once during your turn", or a lasting keyword grant
 * (LASTING_KEYWORD_GRANT).
 */
export function isRepeatingTrigger(card: LorcanaCard): boolean {
  if (!card.text) return false;
  const t = normalizeCardText(card);
  if (!INKWELL_TRIGGER_PATTERNS.some((p) => p.test(t))) return false;
  return !/once\s+during\s+your\s+turn/i.test(t) && !LASTING_KEYWORD_GRANT.test(t);
}

const YOUR_TURN_ONLY = /\bduring your turn\b/i;
const THEIR_TURN_ONLY = /\bduring (?:their|an opponent's|opponents') turns?\b/i;

/** The turn that every sentence matching one of `patterns` is limited to, if they share one. */
function clauseTurn(card: LorcanaCard, patterns: RegExp[]): 'yours' | 'theirs' | undefined {
  const clauses = normalizeCardText(card)
    .split(SENTENCE_BREAK)
    .filter((s) => patterns.some((p) => p.test(s)));
  if (clauses.length === 0) return undefined;
  if (clauses.every((s) => THEIR_TURN_ONLY.test(s))) return 'theirs';
  if (clauses.every((s) => YOUR_TURN_ONLY.test(s))) return 'yours';
  return undefined;
}

/**
 * True when a ramp card puts ink into your inkwell only on the turn an inkwell trigger can't
 * fire: Ink Amplifier ramps "during their turn", and every inkwell trigger fires only "during
 * your turn" (Fairy Godmother's Wand, Scrooge McDuck - Miserly Ebenezer, Chief Tui - Weaving a
 * Tale), so the trigger never sees that ink.
 */
export function inkLandsOffTriggerTurn(rampCard: LorcanaCard, triggerCard: LorcanaCard): boolean {
  const rampTurn = clauseTurn(rampCard, INKWELL_RAMP_PATTERNS);
  const triggerTurn = clauseTurn(triggerCard, INKWELL_TRIGGER_PATTERNS);
  return rampTurn !== undefined && triggerTurn !== undefined && rampTurn !== triggerTurn;
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
