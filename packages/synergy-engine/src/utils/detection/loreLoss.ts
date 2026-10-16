import type {LorcanaCard} from '../../types';
import {normalizeCardText} from '../cardHelpers.js';

// ============================================
// LORE DENIAL DETECTION
// ============================================

/** Cards that directly make the opponent lose lore (any form — burn or steal) */
export const LORE_LOSS_PATTERN = /(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i;

/**
 * Lore Steal patterns — opponent loses lore AND you gain lore from the same effect.
 * Three structural shapes cover the canonical Lorcana phrasings:
 *   1. "loses X lore and you gain X lore"  (single sentence, conjoined)
 *   2. "loses X lore. (You )?Gain X lore"  (separate sentences)
 *   3. "gain lore equal to (the )?lore lost"  (variable transfer)
 * Cards matching any → Steal role; cards matching only LORE_LOSS_PATTERN → Burn role.
 */
const LORE_STEAL_PATTERNS: RegExp[] = [
  /loses?\s+\d+\s+lore\s+and\s+you\s+gain\s+\d+\s+lore/i,
  /loses?\s+\d+\s+lore\.\s*(?:you\s+)?gain\s+\d+\s+lore/i,
  /gain\s+lore\s+equal\s+to\s+(?:the\s+)?lore\s+lost/i,
];

export type LoreDenialRole = 'burn' | 'steal';

/**
 * Determine the lore-denial role(s) a card fulfills.
 * Returns ['steal'] if a transfer pattern matches, ['burn'] if only the bare lore-loss matches, [] otherwise.
 * Burn and Steal are mutually exclusive — a card is one or the other.
 */
export function getLoreDenialRoles(card: LorcanaCard): LoreDenialRole[] {
  if (!card.text) return [];
  const text = normalizeCardText(card);
  if (!LORE_LOSS_PATTERN.test(text)) return [];
  if (LORE_STEAL_PATTERNS.some((p) => p.test(text))) return ['steal'];
  return ['burn'];
}

export const isLoreDenialCard = (card: LorcanaCard): boolean => getLoreDenialRoles(card).length > 0;
