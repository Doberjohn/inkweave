import type {LorcanaCard} from '../../types';
import {hasAnyShift, hasClassification, isCharacter, normalizeCardText} from '../cardHelpers.js';

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
/**
 * rebuy-payoff — a "when you play this character" ETB whose effect is unambiguous re-fire value.
 * A deck look counts only when a card from it goes to your hand, in the look's sentence or the
 * next: Jafar - Lamp Thief's "look at the top 2 cards of your deck. Put one on the top of your
 * deck and the other on the bottom." only orders the deck.
 */
const BOUNCE_ETB_PATTERN = /when\s+you\s+play\s+this\s+character/i;
const BOUNCE_REBUY_EFFECT_PATTERN =
  /draw\s+(?:\d+|two|three)\s+cards?|search\s+your\s+(?:deck|library)|look at the top \d+ cards of your deck[^.]*(?:\.\s*[^.]*)?\binto your hand|banish\s+(?:a|an|another\s+)?chosen\s+character|(?:play|put)\s+(?!this\s+character)[^.]{0,50}?for free|without paying/i;
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
