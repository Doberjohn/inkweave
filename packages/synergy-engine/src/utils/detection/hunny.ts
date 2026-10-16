import type {LorcanaCard} from '../../types';
import {hasClassification, isCharacter, normalizeCardText} from '../cardHelpers.js';

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
 * 'buff' (single-target pump of a chosen Hunny, or a location's pump of the Hunny characters
 * there).
 */
export type HunnyRole = 'member' | 'density' | 'search' | 'buff';

const HUNNY_PAYOFF_PATTERN = /\bHunny (?:character|card|classification)/i;
const HUNNY_DENSITY_PATTERN = /(?:\d+ or more other|another|your other)\s+Hunny characters?/i;
const HUNNY_SEARCH_PATTERN = /search your deck for a Hunny card|Hunny card[^.]*put it into your hand/i;
const HUNNY_BUFF_PATTERN = /chosen Hunny character/i;
/** A location's pump of the Hunny characters there (Hundred Acre Wood - Hunny Campsite). */
const HUNNY_LOCATION_BUFF_PATTERN = /\bHunny characters (?:get|gain)\b[^.]*\bwhile here\b/i;

/** Detect Hunny-scoped payoff roles from card text (density, search, buff). */
function detectHunnyPayoffRoles(text: string, roles: HunnyRole[]): void {
  if (HUNNY_DENSITY_PATTERN.test(text)) roles.push('density');
  if (HUNNY_SEARCH_PATTERN.test(text)) roles.push('search');
  if (HUNNY_BUFF_PATTERN.test(text) || HUNNY_LOCATION_BUFF_PATTERN.test(text)) roles.push('buff');
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

/** A density payoff that buffs your other Hunny characters (Gopher - Hunny Cook's Resist). */
const HUNNY_TEAM_BUFF_PATTERN = /your other Hunny characters (?:get|gain)\b/i;

/**
 * True iff the card's Hunny ability buffs your other Hunny characters. The density role takes it
 * (it names "your other Hunny characters"), but it reads as a buff, not as a count.
 */
export function isHunnyTeamBuff(card: LorcanaCard): boolean {
  return HUNNY_TEAM_BUFF_PATTERN.test(normalizeCardText(card));
}

/** Magical Hunny Staff's GIFT OF THE HIVE gives a character of yours the Hunny classification. */
const HUNNY_GRANT_PATTERN = /\bthe Hunny classification\b/i;

/**
 * True iff a Hunny member counts as a Hunny character for the payoffs that count or choose one: a
 * Hunny character, or a card that gives one of your characters the classification (Magical Hunny
 * Staff). Big Book of Hunny and Hundred Acre Wood - Hunny Campsite carry the classification
 * without being characters, so only a search for a "Hunny card" finds them.
 */
export function countsAsHunnyCharacter(card: LorcanaCard): boolean {
  return isCharacter(card) || HUNNY_GRANT_PATTERN.test(normalizeCardText(card));
}
