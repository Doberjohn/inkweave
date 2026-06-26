import type {LorcanaCard} from 'inkweave-synergy-engine';

export type FranchiseId = 'monsters-inc' | 'up' | 'turning-red';

export interface FranchiseConfig {
  id: FranchiseId;
  label: string;
  /** Value to match against `card.franchise`. */
  match: string;
}

export const FRANCHISES: readonly FranchiseConfig[] = [
  {id: 'monsters-inc', label: 'Monsters, Inc.', match: 'Monsters, Inc.'},
  {id: 'up', label: 'Up', match: 'Up'},
  {id: 'turning-red', label: 'Turning Red', match: 'Turning Red'},
];

/**
 * Filter cards by franchise using the explicit `franchise` field on preview cards.
 * Only preview cards have this field set; main-pool cards are filtered out when
 * a franchise filter is active.
 *
 * Pass `null` to disable filtering (returns true for all cards).
 */
export function matchesFranchise(card: LorcanaCard, franchise: FranchiseId | null): boolean {
  if (!franchise) return true;
  const config = FRANCHISES.find((f) => f.id === franchise);
  if (!config) return true;
  return card.franchise === config.match;
}
