import type {LorcanaCard} from '../../types';
import {hasClassification, hasKeywordExact, isCharacter, normalizeCardText} from '../cardHelpers.js';

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

/**
 * Static team buff: "Your [...] Floodborn characters get/gain ...". The gap after "characters"
 * stops at a comma, so a trigger's own clause can't reach the player's "gain": "whenever one of
 * your Floodborn characters banishes another character in a challenge, gain 1 lore" (Scar -
 * Created by the Vine) is a trigger, not a buff.
 */
const FLOODBORN_BUFF_PATTERN = /your\b[^.]*\bfloodborn characters?\b[^.,]*\b(?:get|gain)\b/i;
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

/**
 * A Floodborn team buff that grants one keyword a second copy adds nothing to: "Your Floodborn
 * characters gain Evasive until the start of your next turn." (Protective Aura).
 */
const FLOODBORN_FLAT_KEYWORD_PATTERN =
  /\bfloodborn characters? gain (Evasive|Alert|Rush|Ward|Bodyguard)(?=\.| until\b)/i;
/** The printed keywords that already give a body the granted one: Evasive covers Alert. */
const FLOODBORN_KEYWORD_COVERED_BY: Record<string, string[]> = {alert: ['Alert', 'Evasive']};

/**
 * True iff the payoff's Floodborn team buff only grants a keyword the member already prints, so
 * it adds nothing to that member (Protective Aura's Evasive on Prince Phillip - Vanquisher of
 * Foes, or Robin Hood - Created by the Vine's Alert on him).
 */
export function floodbornBuffAlreadyPrinted(payoff: LorcanaCard, member: LorcanaCard): boolean {
  const keyword = normalizeCardText(payoff).match(FLOODBORN_FLAT_KEYWORD_PATTERN)?.[1];
  if (keyword === undefined) return false;
  const covering = FLOODBORN_KEYWORD_COVERED_BY[keyword.toLowerCase()] ?? [keyword];
  return covering.some((printed) => hasKeywordExact(member, printed));
}
