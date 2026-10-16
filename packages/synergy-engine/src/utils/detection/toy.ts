import type {LorcanaCard} from '../../types';
import {
  getShiftBaseNames,
  hasClassification,
  makeBanishTriggerPattern,
  makeSearchPattern,
  normalizeCardText,
} from '../cardHelpers.js';
import type {DiscardRole} from './discard.js';
import {getDiscardRoles} from './discard.js';
import type {LoreDenialRole} from './loreLoss.js';
import {getLoreDenialRoles} from './loreLoss.js';
import {getNamedReferences} from './namedCompanions.js';
import type {RampRole} from './ramp.js';
import {COST_REDUCTION_SELF_PATTERN, getRampRoles, SELF_DISCOUNT_FREE_PATTERN} from './ramp.js';

// ============================================
// TOY TRIBAL DETECTION
// ============================================

/**
 * Detects cards whose text references Toy characters (payoff role).
 * Uses "Toy character[s]" rather than bare "Toy" to skip ability-name false
 * positives (e.g., Buzz Lightyear — On the Way's "WORLD'S GREATEST TOY" name).
 */
const TOY_PAYOFF_PATTERN = /\bToy characters?\b/i;

/** Toy-scoped Search — uses the shared helper with Toy character as target */
const TOY_SEARCH_PATTERN = makeSearchPattern('Toy characters?(?:\\s+cards?)?');

/**
 * Toy-scoped Banish trigger — fires on a Toy banish event.
 * Two targets OR'd: tribal ("when a Toy character is banished") and self
 * ("when this character is banished"). Inside getToyRoles the membership
 * gate ensures self-banish only counts when the carrying card is itself a
 * Toy — so "this character" is structurally equivalent to "a Toy character".
 */
const TOY_BANISH_TRIGGER_TRIBAL_PATTERN = makeBanishTriggerPattern('Toy characters?');
const TOY_BANISH_TRIGGER_SELF_PATTERN = makeBanishTriggerPattern('this character');

/** Generic Draw mechanic — literal "draw a card" / "draw N cards". Used by Toys and the mechanics catalog. */
export const DRAW_PATTERN = /(?:you may )?draws? (?:a|\d+) cards?/i;

/**
 * Roles in the Toy tribal playstyle.
 *
 * Composes with other playstyles' role detection:
 * - 'member' — Toy classification (Toy-specific)
 * - Toy-scoped mechanics: 'search', 'draw', 'banish-trigger', 'self-discount'
 * - Lore Denial roles: 'burn', 'steal'
 * - Discard roles: 'targeted', 'random', 'standard' (Discard's own 'payoff' is excluded —
 *   hand-size advantage is a Discard-playstyle concept, not a Toy concept)
 * - Ramp roles: 'inkwell-ramp', 'inkwell-trigger', 'cost-reduction'
 *
 * The generic 'payoff' fallback was retired once every Toy in the live database
 * mapped onto a specific mechanic. A card can still enter the playstyle without
 * a specific role (via TOY_PAYOFF_PATTERN text reference), but it will only
 * surface in synergy results if some specific mechanic is also detected.
 */
export type ToyRole =
  | 'member'
  | 'search'
  | 'draw'
  | 'banish-trigger'
  | 'self-discount'
  | LoreDenialRole
  | Exclude<DiscardRole, 'payoff'>
  | RampRole;

/**
 * The Toy roles that reward Toy density, scored as tribal payoffs. The generic mechanics a Toy
 * card picks up from other playstyles (draw, burn, ramp) don't compound with tribal mass.
 */
export const TOY_TRIBAL_ROLES: readonly ToyRole[] = ['search', 'banish-trigger', 'self-discount'];

/** Compose roles from other playstyles' detectors (Lore Denial, Discard, Ramp). */
function composeCrossPlaystyleToyRoles(card: LorcanaCard, roles: ToyRole[]): void {
  for (const r of getLoreDenialRoles(card)) roles.push(r);
  for (const r of getDiscardRoles(card)) {
    if (r !== 'payoff') roles.push(r); // Discard's hand-size payoff is a different concept
  }
  for (const r of getRampRoles(card)) roles.push(r);
}

/** Detect Toy-scoped mechanic roles from card text (search, draw, banish-trigger, self-discount). */
function detectToyScopedRoles(text: string, roles: ToyRole[]): void {
  if (TOY_SEARCH_PATTERN.test(text)) roles.push('search');
  if (DRAW_PATTERN.test(text)) roles.push('draw');
  const isBanishTrigger =
    TOY_BANISH_TRIGGER_TRIBAL_PATTERN.test(text) || TOY_BANISH_TRIGGER_SELF_PATTERN.test(text);
  if (isBanishTrigger) roles.push('banish-trigger');
  const isSelfDiscount =
    COST_REDUCTION_SELF_PATTERN.test(text) || SELF_DISCOUNT_FREE_PATTERN.test(text);
  if (isSelfDiscount) roles.push('self-discount');
}

export function getToyRoles(card: LorcanaCard): ToyRole[] {
  const isMember = hasClassification(card, 'Toy');
  const text = card.text != null ? normalizeCardText(card) : '';
  const isTribePayoff = text !== '' && TOY_PAYOFF_PATTERN.test(text);

  // Not a Toy at all — no playstyle membership, no role composition
  if (!isMember && !isTribePayoff) return [];

  const roles: ToyRole[] = [];
  if (isMember) roles.push('member');
  // Gated above by Toy membership/text so cross-playstyle composition can't promote non-Toy cards.
  composeCrossPlaystyleToyRoles(card, roles);
  detectToyScopedRoles(text, roles);
  return roles;
}

export const isToyCard = (card: LorcanaCard): boolean => getToyRoles(card).length > 0;

/**
 * True iff `payoff`'s ability counts `member`: its text names Toy characters, or names the member
 * itself (Bullseye - Loyal Horse's discount needs Woody or Jessie, which Woody & Buzz Lightyear
 * meets through its first half). Rex - Protective Dinosaur and Pterodactyl Janie Doll hold Toy
 * payoff roles for their own banish, which counts no other Toy.
 */
export function toyAbilityCounts(payoff: LorcanaCard, member: LorcanaCard): boolean {
  if (TOY_PAYOFF_PATTERN.test(normalizeCardText(payoff))) return true;
  // A team card carries each half's name, the same names it can be shifted onto.
  const memberNames = getShiftBaseNames(member);
  return getNamedReferences(payoff).some((name) => memberNames.includes(name));
}
