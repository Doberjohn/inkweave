import type {LorcanaCard} from 'inkweave-synergy-engine';

/**
 * A synergy line with its {A}/{B} chip tokens written out as card names, for a place that shows
 * the line as plain text (a tile's tooltip). {A} is the card whose synergies these are, {B} its
 * partner. Two versions of one character go by their full names, so the line tells them apart.
 */
export function fillChipNames(explanation: string, cardA: LorcanaCard, cardB: LorcanaCard): string {
  const sameName = cardA.name === cardB.name;
  const nameOf = (card: LorcanaCard) => (sameName ? card.fullName : card.name);
  return explanation.replace(/\{([AB])\}/g, (_token, side: string) =>
    nameOf(side === 'A' ? cardA : cardB),
  );
}
