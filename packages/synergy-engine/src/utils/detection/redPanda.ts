import type {LorcanaCard} from '../../types';
import {hasClassification, normalizeCardText} from '../cardHelpers.js';

// ============================================
// RED PANDA TRIBAL DETECTION
// ============================================

/**
 * Red Panda tribe (Turning Red, Set 13). Membership is the Red Panda classification.
 * The lone tribal payoff is a deck search; the pattern matches the search shape
 * ("reveal a Red Panda character"), NOT bare "Red Panda character", so Sun Yee's
 * Temporary Red Panda Shift reminder text ("on top of one of your Red Panda characters")
 * does not false-positive.
 */
export type RedPandaRole = 'member' | 'search';

const RED_PANDA_SEARCH_PATTERN = /reveal a Red Panda character/i;

export function getRedPandaRoles(card: LorcanaCard): RedPandaRole[] {
  const isMember = hasClassification(card, 'Red Panda');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isSearch = text !== '' && RED_PANDA_SEARCH_PATTERN.test(text);

  if (!isMember && !isSearch) return [];

  const roles: RedPandaRole[] = [];
  if (isMember) roles.push('member');
  if (isSearch) roles.push('search');
  return roles;
}

export const isRedPandaCard = (card: LorcanaCard): boolean => getRedPandaRoles(card).length > 0;
