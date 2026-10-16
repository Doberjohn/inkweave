import type {LorcanaCard} from '../../types';
import {isAction, normalizeCardText} from '../cardHelpers.js';

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
