import type {LorcanaCard} from '../../types';
import {normalizeCardText} from '../cardHelpers.js';

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

/** Every banish trigger on a card, counted against the opponent's-turn ones below. */
const SACRIFICE_BANISH_TRIGGERS = new RegExp(SACRIFICE_BANISH_TRIGGER_PATTERN.source, 'gi');

/**
 * A banish trigger that fires only on an opponent's turn ("During an opponent's turn, when this
 * character is banished", "During opponents' turns, whenever one of your other characters is
 * banished"). Every self-banish card banishes on your own turn (an action, a ⟳ ability or an
 * on-play effect), so it never sets such a trigger off.
 */
const SACRIFICE_OPPONENT_TURN_TRIGGERS = new RegExp(
  `\\bduring (?:an opponent's turn|opponents' turns),\\s*${SACRIFICE_BANISH_TRIGGER_PATTERN.source}`,
  'gi',
);

/**
 * The any-character half of SACRIFICE_BANISH_TRIGGER_PATTERN: the payoff fires when any of your
 * characters is banished, not only when the card itself is.
 */
const SACRIFICE_ANY_BANISH_TRIGGER_PATTERN =
  /when(?:ever)?\s+(?:(?:one of\s+)?your(?:\s+other)?(?:\s+\w+)?\s+characters?|a\s+character\s+of\s+yours)\s+(?:is|are|gets?)\s+banished/i;

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

/**
 * True iff a banish payoff can fire on your own turn, when a self-banish card acts: some banish
 * trigger on it isn't limited to an opponent's turn (see SACRIFICE_OPPONENT_TURN_TRIGGERS).
 */
export function banishTriggerFiresOnYourTurn(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  const triggers = text.match(SACRIFICE_BANISH_TRIGGERS)?.length ?? 0;
  return triggers > (text.match(SACRIFICE_OPPONENT_TURN_TRIGGERS)?.length ?? 0);
}

/**
 * A banish payoff that gives back almost nothing: it returns only another card of its own name
 * ("return another character card named Alien from your discard to your hand", Alien - True
 * Believer), or only puts itself on the bottom of your deck ("put this card from your discard on
 * the bottom of your deck", Merlin - Envisioning the Future).
 */
const SACRIFICE_THIN_PAYOFFS =
  /\bwhen this character is banished, (?:return another character card named [^.]+ from your discard to your hand|put this card from your discard on the bottom of your deck)\./gi;

/**
 * True iff every banish trigger on a payoff gives back almost nothing (SACRIFICE_THIN_PAYOFFS), so
 * a self-banish card that cashes it in gains too little for the combo.
 */
export function banishPayoffPaysLittle(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  const triggers = text.match(SACRIFICE_BANISH_TRIGGERS)?.length ?? 0;
  return triggers > 0 && (text.match(SACRIFICE_THIN_PAYOFFS)?.length ?? 0) >= triggers;
}

/**
 * True iff a banish payoff fires when any of your characters is banished (David Xanatos), not only
 * when it is banished itself (Kuzco). The two read differently in a payoff-payoff pair.
 */
export function triggersOnAnyBanish(card: LorcanaCard): boolean {
  return SACRIFICE_ANY_BANISH_TRIGGER_PATTERN.test(normalizeCardText(card));
}
