import type {LorcanaCard} from '../../types';
import {normalizeCardText} from '../cardHelpers.js';

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

/** Healer (enabler): an outlet that removes damage from a character, or spreads a "damage total"
 *  over several. Begins with "remove", so a "move ... damage" clause on the same card can never
 *  fabricate a false healer here. */
const HEALER_PATTERN = /remove (?:up to \d+|all|\d+) damage (?:total )?from/i;

/**
 * Heal-payoff: a benefit triggered or gated on removing damage. Covers the repeating
 * "whenever/when you remove damage" triggers, the "if you removed damage" turn-state
 * condition, and the "for each N damage removed" / "remove 1 or more damage" count payoffs.
 * A bonus for the card's own heal ("If you removed damage this way", "for each 1 damage
 * removed this way") is no payoff: no other healer can feed it, so the card is only a healer.
 */
const HEAL_PAYOFF_PATTERN =
  /whenever you remove damage|when you remove damage|if you removed damage(?! this way)|for each \d+ damage removed(?! this way)|remove 1 or more damage/i;

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

/**
 * Temporary Shift's reminder text: "At the end of your turn, remove all damage from this
 * character and return only this card to your hand." It heals only a character that took
 * damage that turn, and only once the turn's actions are done.
 */
const TEMPORARY_SHIFT_HEAL_PATTERN =
  /\bat the end of your turn, remove all damage from this character and return only this card to your hand\b/i;

/**
 * The card's only heal is Temporary Shift's end-of-turn cleanup (Grandma Wu - Fierce Red Panda,
 * Sun Yee - Red Panda Spirit): no remove clause is left once the reminder text is taken out.
 */
export function healsOnlyAsTemporaryShiftEnds(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  if (!TEMPORARY_SHIFT_HEAL_PATTERN.test(text)) return false;
  return !HEALER_PATTERN.test(text.replace(TEMPORARY_SHIFT_HEAL_PATTERN, ''));
}

/** A heal payoff that triggers on the removal: "Whenever you remove 1 or more damage …". */
const HEAL_TRIGGER_PATTERN = /\b(?:whenever|when) you remove\b/i;

/**
 * The payoff fires on the removal itself. A turn check ("⟳ — If you removed damage from a
 * character this turn, gain 1 lore", Julieta's Arepas) is used while you act, so a heal that
 * lands as the turn ends never meets it.
 */
export function healPayoffTriggers(card: LorcanaCard): boolean {
  return HEAL_TRIGGER_PATTERN.test(normalizeCardText(card));
}
