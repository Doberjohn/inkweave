import type {LorcanaCard} from '../../types';
import {normalizeCardText} from '../cardHelpers.js';

// ============================================
// DISCARD CONTROL DETECTION
// ============================================

/** Discard role: enabler (forces opponent to discard) or payoff (rewards hand-size advantage) */
export type DiscardRole = 'targeted' | 'random' | 'standard' | 'payoff';

/**
 * Enabler patterns — cards that force opponents to lose cards from hand.
 * Covers: forced discard, targeted (reveal+pick), hand-cap, symmetric, and indirect.
 */
/**
 * Targeted: opponent reveals their hand and you/they discard a SPECIFIC card type
 * (song / action / location / non-character). Highest player agency — you pick the type.
 */
const DISCARD_TARGETED_PATTERN =
  /reveals?\s+their\s+hand\s+and\s+discards?\s+(?:a|an)\s+(?:song|action|location|non-character)\s+card\s+of\s+your\s+choice/i;

/**
 * Random: opponent loses cards without choice (luck-based).
 * Includes "discards X cards at random" and "that player discards a card at random".
 */
const DISCARD_RANDOM_PATTERN = /discards\s+(?:a|an|\d+)\s+cards?\s+at\s+random/i;

/**
 * Generic discard patterns — choose-and-discard, hand-cap, symmetric, mass.
 * Match if the card is NOT already classified as targeted or random.
 */
const DISCARD_GENERIC_PATTERNS: RegExp[] = [
  // "each/chosen opponent chooses and discards" + "have opponent choose and discard"
  /(each|chosen)\s+opponents?\s+(chooses?\s+and\s+discards?|reveals?\s+their\s+hand\s+and\s+discards?|discards?)/i,
  /have\s+(each|chosen)\s+opponents?\s+choose\s+and\s+discard/i,
  // Symmetric / indirect: "each/challenging player...discards"
  /(each|challenging)\s+player\s+(?:may\s+)?chooses?\s+and\s+discards?/i,
  // Hand-cap: "more than X cards in their hand...discard"
  /more\s+than\s+\d+\s+cards\s+in\s+their\s+hand.*discard/i,
  // Comparative: "most cards in their hands choose and discard"
  /most\s+cards\s+in\s+their\s+hands?\s+choose\s+and\s+discard/i,
];

/** Payoff pattern — cards that reward having more cards in hand than opponent */
const DISCARD_PAYOFF_PATTERN = /more\s+cards\s+in\s+your\s+hand\s+than\s+(?:each\s+)?opponents?/i;

/** Fast pre-filter: all enabler patterns contain "discard", payoff contains "hand" */
const HAS_DISCARD_KEYWORD = /discard|more cards in your hand/i;

/**
 * Determine the discard role(s) a card fulfills.
 * Returns an array of roles (a card could theoretically be both).
 */
export function getDiscardRoles(card: LorcanaCard): DiscardRole[] {
  if (!card.text) return [];
  const normalizedText = normalizeCardText(card);
  if (!HAS_DISCARD_KEYWORD.test(normalizedText)) return [];

  const roles: DiscardRole[] = [];

  // Disruption roles are mutually exclusive — check most specific first.
  if (DISCARD_TARGETED_PATTERN.test(normalizedText)) {
    roles.push('targeted');
  } else if (DISCARD_RANDOM_PATTERN.test(normalizedText)) {
    roles.push('random');
  } else if (DISCARD_GENERIC_PATTERNS.some((p) => p.test(normalizedText))) {
    roles.push('standard');
  }

  if (DISCARD_PAYOFF_PATTERN.test(normalizedText)) {
    roles.push('payoff');
  }

  return roles;
}

/**
 * Check if a card is a discard control card (enabler or payoff).
 */
export function isDiscardCard(card: LorcanaCard): boolean {
  return getDiscardRoles(card).length > 0;
}
