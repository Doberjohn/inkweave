import type {LorcanaCard} from '../../types';
import {normalizeCardText, SENTENCE_BREAK} from '../cardHelpers.js';

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

/** A strength cap on an exert effect: "exert chosen opposing character with 2 ¤ or less". */
const EXERT_STRENGTH_CAP = /\bwith (\d+) ¤ or less\b/i;
/** A strength floor on a payoff: "banish chosen exerted character with 5 ¤ or more". */
const EXERT_STRENGTH_FLOOR = /\bwith (\d+) ¤ or more\b/i;
/** Every payoff shape, to find the sentences that carry a payoff's floor. */
const EXERT_PAYOFF_PATTERNS = [
  EXERT_PAYOFF_TRIGGER,
  EXERT_PAYOFF_BANISH,
  EXERT_PAYOFF_CANT_READY,
  EXERT_PAYOFF_OPP_STATE,
  EXERT_PAYOFF_LORE,
];

/**
 * The most ¤ a character the enabler exerts can have: the highest "with N ¤ or less" cap among
 * its exert effects, or Infinity when one of them has none.
 */
function exertStrengthReach(text: string): number {
  const caps = text
    .split(SENTENCE_BREAK)
    .filter((sentence) => isExertEnabler(sentence))
    .map((sentence) => Number(EXERT_STRENGTH_CAP.exec(sentence)?.[1] ?? Infinity));
  return caps.length > 0 ? Math.max(...caps) : Infinity;
}

/**
 * The least ¤ an exerted character needs for the payoff to act on it: the lowest "with N ¤ or
 * more" floor among its payoff effects, or 0 when one of them has none.
 */
function exertStrengthFloor(text: string): number {
  const floors = text
    .split(SENTENCE_BREAK)
    .filter((sentence) => EXERT_PAYOFF_PATTERNS.some((pattern) => pattern.test(sentence)))
    .map((sentence) => Number(EXERT_STRENGTH_FLOOR.exec(sentence)?.[1] ?? 0));
  return floors.length > 0 ? Math.min(...floors) : 0;
}

/**
 * True iff the enabler can exert a character the payoff acts on. Minnie Mouse - Sweetheart
 * Princess banishes an exerted character "with 5 ¤ or more", which an effect that exerts one
 * "with 2 ¤ or less" (Ghostly Tale) never sets up.
 */
export function exertEnablerReachesPayoff(enabler: LorcanaCard, payoff: LorcanaCard): boolean {
  const reach = exertStrengthReach(normalizeCardText(enabler));
  return reach >= exertStrengthFloor(normalizeCardText(payoff));
}
