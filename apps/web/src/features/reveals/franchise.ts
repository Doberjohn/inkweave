import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';

export type FranchiseId = 'monsters-inc' | 'up' | 'turning-red';

export interface FranchiseConfig {
  id: FranchiseId;
  label: string;
  /** Value to match against `card.franchise`. */
  match: string;
  /**
   * Canonical ink used to tint the franchise card's bloom glow on the reveals
   * page. These franchises span multiple inks in the data, so this is a curated
   * association (design intent), not derived from the card pool.
   */
  ink: Ink;
  /** One-line description shown on the reveals page's new-franchises card. */
  blurb: string;
}

export const FRANCHISES: readonly FranchiseConfig[] = [
  {
    id: 'monsters-inc',
    label: 'Monsters, Inc.',
    match: 'Monsters, Inc.',
    ink: 'Emerald',
    blurb: 'Sulley, Mike and the laughter that powers a whole city.',
  },
  {
    id: 'up',
    label: 'Up',
    match: 'Up',
    ink: 'Sapphire',
    blurb: 'Carl, Russell and the house that flew on a thousand balloons.',
  },
  {
    id: 'turning-red',
    label: 'Turning Red',
    match: 'Turning Red',
    ink: 'Ruby',
    blurb: 'Mei Lee, her friends, and the red panda within.',
  },
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
