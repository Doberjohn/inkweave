import type {LorcanaCard} from '../../types';
import {hasClassification, normalizeCardText} from '../cardHelpers.js';

// ============================================
// SEVEN DWARFS TRIBAL DETECTION
// ============================================

/**
 * Tribe-payoff gate: text references the Seven Dwarfs tribe. Bare "Seven Dwarfs"
 * is safe — no card in the database *names* an ability "Seven Dwarfs", so there
 * is no caps ability-name false positive (unlike Toy's "WORLD'S GREATEST TOY").
 * Matches all 5 payoff cards; membership itself is a subtype check, not regex.
 */
const DWARFS_PAYOFF_PATTERN = /\bSeven Dwarfs\b/i;

/** Density payoff: a benefit gated on having Seven Dwarfs characters in play. */
const DWARFS_DENSITY_PATTERN = /if you have (?:another |a |an |\d+ or more )?Seven Dwarfs/i;

/** Recruit: cheat a Seven Dwarfs character into play for free (Right Behind You). */
const DWARFS_RECRUIT_PATTERN = /play a Seven Dwarfs character[^.]*for free/i;

/** Return: bounce one of your Seven Dwarfs back to hand for value (Snow White - Merry). */
const DWARFS_RETURN_PATTERN = /return (?:chosen )?(?:a |an )?Seven Dwarfs character/i;

/**
 * Roles in the Seven Dwarfs tribal playstyle (modeled on the Toy rule):
 * - 'member'  — Seven Dwarfs classification (the 14 subtype cards)
 * - 'density' — pays off having Seven Dwarfs in play
 * - 'recruit' — plays a Seven Dwarfs character for free
 * - 'return'  — returns a Seven Dwarfs character to hand for value
 *
 * The "OR Princess" satisfier on the payoff cards is intentionally NOT modeled —
 * Princess density belongs to the (separate) Princesses playstyle. A card enters
 * this playstyle only via the Seven Dwarfs subtype or a Seven Dwarfs text reference.
 */
export type DwarfsRole = 'member' | 'density' | 'recruit' | 'return';

/** Detect Seven-Dwarfs-scoped payoff roles from card text (density, recruit, return). */
function detectDwarfsPayoffRoles(text: string, roles: DwarfsRole[]): void {
  if (DWARFS_DENSITY_PATTERN.test(text)) roles.push('density');
  if (DWARFS_RECRUIT_PATTERN.test(text)) roles.push('recruit');
  if (DWARFS_RETURN_PATTERN.test(text)) roles.push('return');
}

export function getDwarfsRoles(card: LorcanaCard): DwarfsRole[] {
  const isMember = hasClassification(card, 'Seven Dwarfs');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isPayoff = text !== '' && DWARFS_PAYOFF_PATTERN.test(text);

  // Not a Seven Dwarfs card at all — no membership, no payoff reference.
  if (!isMember && !isPayoff) return [];

  const roles: DwarfsRole[] = [];
  if (isMember) roles.push('member');
  detectDwarfsPayoffRoles(text, roles);
  return roles;
}

export const isDwarfsCard = (card: LorcanaCard): boolean => getDwarfsRoles(card).length > 0;
