import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';

/** The franchises debuting in the reveal set. Per-season content: Set 14 has one. */
export type FranchiseId = 'coco';

export interface FranchiseConfig {
  id: FranchiseId;
  label: string;
  /** Value to match against `card.franchise`. */
  match: string;
  /**
   * The franchise's one accent colour on the reveals page: its What's New card
   * (NEW pill, CTA, wash, glow) and its cards modal (border, glow, eyebrow). A
   * franchise's cards span several inks, so this is a curated association
   * (design intent), not derived from the card pool.
   */
  ink: Ink;
  /** One-line description shown on the franchise's What's New card. */
  blurb: string;
}

export const FRANCHISES: readonly FranchiseConfig[] = [
  {
    id: 'coco',
    label: 'Coco',
    match: 'Coco',
    ink: 'Amber',
    blurb: 'Drop in for a Beat.',
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
